import type { DocxExportMode } from "../tauri/exportDocxApi";
import type { SegmentDto } from "../tauri/projectApi";
import {
  postprocessExportPolish,
  type PostprocessExportPolishRequest,
} from "../tauri/postprocessApi";
import { countUnicodeScalars } from "./exportDocxPolish.helpers";
import {
  isLocalLoopbackLlmConfig,
  llmConfigHint,
  tryBuildPostprocessRuntimeBridge,
} from "./postprocess/postprocessRuntimeContract";
import { correctionStableRulesList } from "../tauri/correctionApi";
import {
  applyRulesToSegmentLines,
  buildExportPolishLineChanges,
  joinLinesForLlmBody,
  reconcileLlmPolishLines,
  segmentLinesFromSegments,
  type ExportPolishLineChange,
  type ReconcileLlmLinesStats,
} from "./exportPolishPipeline";
import { assertExportPolishParagraphsAlignLines } from "./exportPolishDelivery";
import { buildExportPolishRuleHints } from "./exportPolishRuleHints";
import {
  buildParagraphsFromBreaks,
  coalesceExportParagraphBreaks,
} from "./exportPolishParagraphs";
import {
  buildExportPolishDiagnosticSummary,
  formatExportPolishDiagnosticHint,
  type ExportPolishDiagnosticSummary,
} from "./exportPolishDiagnostics";
import { applyExportPolishHygiene } from "./exportPolishHygiene";
import {
  fingerprintExportPolishSegments,
  setExportPolishPreviewCache,
  tryAdoptExportPolishPreview,
} from "./exportPolishPreviewCache";

const POLISH_MODES: DocxExportMode[] = ["lecture", "clean"];

export type ExportPolishResult = {
  paragraphs: string[];
  correctedLines: string[];
  /** 导出前预览：有修订的语段行。 */
  lineChanges: ExportPolishLineChange[];
  breakAfterLine: number[];
  /** 分阶段诊断（排查「只改标点」）。 */
  diagnostic: ExportPolishDiagnosticSummary;
  diagnosticHint: string | null;
  /** 生成预览时的语段正文指纹。 */
  segmentsFingerprint: string;
  /** LLM 行对齐统计（预览说明保留原文等）。 */
  reconcileStats: ReconcileLlmLinesStats;
};

export function exportModeSupportsLlmPolish(mode: DocxExportMode): boolean {
  return POLISH_MODES.includes(mode);
}

function resolveExportPolishBodyBlockReason(segments: SegmentDto[]): string | null {
  const lines = segmentLinesFromSegments(segments);
  if (lines.length === 0) {
    return "当前没有可导出的正文。";
  }
  const body = joinLinesForLlmBody(lines);
  if (isLocalLoopbackLlmConfig() && countUnicodeScalars(body) > 40_000) {
    return "本机 LLM 润色建议单次不超过约 4 万字；请删减语段、分批导出，或改用云端模型。";
  }
  if (countUnicodeScalars(body) > 120_000) {
    return "正文过长（超过 12 万字），请先删减语段或取消大模型润色。";
  }
  return null;
}

export function resolveExportPolishBlockReason(
  segments: SegmentDto[],
  llmBlockReason?: string | null,
): string | null {
  const bodyBlock = resolveExportPolishBodyBlockReason(segments);
  if (bodyBlock) return bodyBlock;
  if (llmBlockReason?.trim()) return llmBlockReason.trim();
  if (!tryBuildPostprocessRuntimeBridge()) {
    return llmConfigHint();
  }
  return null;
}

/** 导出时优先复用预览缓存，避免二次请求 LLM。 */
export function resolveExportPolishForDelivery(
  segments: SegmentDto[],
  polishPreview?: ExportPolishResult | null,
): ExportPolishResult {
  const fp = fingerprintExportPolishSegments(segments);
  if (polishPreview && polishPreview.segmentsFingerprint !== fp) {
    throw new Error("语段正文已变更，请重新生成预览后再导出。");
  }
  const adopted = tryAdoptExportPolishPreview(segments, polishPreview);
  if (adopted) {
    if (adopted.segmentsFingerprint !== fp) {
      throw new Error("预览缓存已失效，请重新生成预览。");
    }
    assertExportPolishParagraphsAlignLines(adopted);
    return adopted;
  }
  if (polishPreview) {
    throw new Error("预览已失效，请重新生成预览。");
  }
  throw new Error("缺少有效润色预览，请先在导出对话框生成预览。");
}

export async function fetchExportPolishResult(
  segments: SegmentDto[],
  options?: { requestId?: string },
): Promise<ExportPolishResult> {
  const block = resolveExportPolishBlockReason(segments);
  if (block) {
    throw new Error(block);
  }
  const runtime = tryBuildPostprocessRuntimeBridge();
  if (!runtime) {
    throw new Error("LLM 未配置。");
  }

  const beforeLines = segmentLinesFromSegments(segments);
  const rules = await correctionStableRulesList();
  const ruleHints = buildExportPolishRuleHints(rules);
  const body = joinLinesForLlmBody(beforeLines);

  const req: PostprocessExportPolishRequest = {
    task: "export_polish",
    requestId: options?.requestId,
    body,
    runtime,
    ruleHints: ruleHints.trim() || undefined,
  };
  const out = await postprocessExportPolish(req);

  if (out.punctLines.length === 0) {
    throw new Error("模型未返回 lines（标点行），请重试。");
  }
  const { lines: llmMerged, stats: reconcileStats } = reconcileLlmPolishLines(
    beforeLines,
    out.punctLines,
  );
  const hygiened = applyExportPolishHygiene(llmMerged);
  const ruled = applyRulesToSegmentLines(hygiened, rules);
  const finalLines = ruled.lines;
  const coalescedBreaks = coalesceExportParagraphBreaks(
    finalLines.length,
    out.breakAfterLine,
  );
  const paragraphs = buildParagraphsFromBreaks(finalLines, coalescedBreaks);
  if (paragraphs.length === 0) {
    throw new Error("无法生成语义自然段，请重试。");
  }

  const lineChanges = buildExportPolishLineChanges(beforeLines, finalLines);
  const diagnostic = buildExportPolishDiagnosticSummary({
    beforeLines,
    llmLines: out.punctLines,
    llmMerged,
    finalLines,
    lineChanges,
    ruleStats: ruled.stats,
    rules,
  });
  let diagnosticHint = formatExportPolishDiagnosticHint(diagnostic);
  if (reconcileStats.llmCount !== reconcileStats.segmentCount) {
    const alignNote = `模型返回 ${reconcileStats.llmCount} 行、语段 ${reconcileStats.segmentCount} 行，已自动对齐${
      reconcileStats.mergedSegmentPairs > 0
        ? `（合并 ${reconcileStats.mergedSegmentPairs} 处）`
        : ""
    }${
      reconcileStats.paddedFromBefore > 0 ? `（${reconcileStats.paddedFromBefore} 行保留原文）` : ""
    }`;
    diagnosticHint = diagnosticHint ? `${diagnosticHint}；${alignNote}` : alignNote;
  }

  const segmentsFingerprint = fingerprintExportPolishSegments(segments);
  const result: ExportPolishResult = {
    paragraphs,
    correctedLines: finalLines,
    lineChanges,
    breakAfterLine: coalescedBreaks,
    diagnostic,
    diagnosticHint,
    segmentsFingerprint,
    reconcileStats,
  };
  assertExportPolishParagraphsAlignLines(result);
  setExportPolishPreviewCache(segments, result);
  return result;
}

/** 预览结果是否仍与当前语段正文一致（可复用导出）。 */
export function exportPolishPreviewIsCurrent(
  segments: SegmentDto[],
  preview: ExportPolishResult | null,
): boolean {
  if (!preview) return false;
  return preview.segmentsFingerprint === fingerprintExportPolishSegments(segments);
}
