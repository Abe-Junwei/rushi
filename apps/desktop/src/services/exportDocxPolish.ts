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
  clampExportPolishLinesToEligible,
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
import { fingerprintExportPolishSegments } from "./exportPolishPreviewCache";

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
  /** 与语段正文对齐用的指纹。 */
  segmentsFingerprint: string;
  /** LLM 行对齐统计（预览说明保留原文等）。 */
  reconcileStats: ReconcileLlmLinesStats;
};

export function exportModeSupportsLlmPolish(mode: DocxExportMode): boolean {
  return POLISH_MODES.includes(mode);
}

/** 干净稿导出必须走大模型润色。 */
export function exportModeRequiresLlmPolish(mode: DocxExportMode): boolean {
  return mode === "clean";
}

export function exportWantsLlmPolish(mode: DocxExportMode, llmPolish: boolean): boolean {
  return exportModeRequiresLlmPolish(mode) || (llmPolish && exportModeSupportsLlmPolish(mode));
}

/**
 * 导出润色预计耗时（秒），供忙碌遮罩展示典型耗时（非请求超时）。
 * 基线刻意小于 Rust `export_polish_timeout_secs`（apps/desktop/src-tauri/src/utils/postprocess_http.rs）
 * 的下限：那是为容忍冷启动/慢网络留的超时安全余量，短内容典型耗时通常只需数秒，
 * 直接复用超时下限会明显高估（如短文云端实测 ~5s，超时下限却是 45s）。
 * 上限沿用超时公式的封顶值，仅作长文档的宽松上限。
 */
export function estimateExportPolishSeconds(charCount: number, loopback: boolean): number {
  const { baseSecs, maxSecs, charsPerExtraSec } = loopback
    ? { baseSecs: 15, maxSecs: 900, charsPerExtraSec: 500 }
    : { baseSecs: 5, maxSecs: 180, charsPerExtraSec: 1500 };
  const extra = Math.floor(charCount / charsPerExtraSec);
  return Math.min(baseSecs + extra, maxSecs);
}

/** 按当前语段正文预估导出润色耗时（秒），供忙碌遮罩展示。 */
export function estimateExportPolishSecondsForSegments(segments: SegmentDto[]): number {
  const body = joinLinesForLlmBody(segmentLinesFromSegments(segments));
  return estimateExportPolishSeconds(countUnicodeScalars(body), isLocalLoopbackLlmConfig());
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
  if (!tryBuildPostprocessRuntimeBridge()) {
    return llmBlockReason?.trim() || llmConfigHint();
  }
  return null;
}

/** 导出前已由控制器拉取的润色结果；校验指纹与段落对齐。 */
export function resolveExportPolishForDelivery(
  segments: SegmentDto[],
  polish: ExportPolishResult,
): ExportPolishResult {
  const fp = fingerprintExportPolishSegments(segments);
  if (polish.segmentsFingerprint !== fp) {
    throw new Error("润色结果与当前语段不一致，请重试导出。");
  }
  assertExportPolishParagraphsAlignLines(polish);
  return polish;
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
    lineCount: beforeLines.length,
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
  const clamped = clampExportPolishLinesToEligible(beforeLines, llmMerged);
  const ruled = applyRulesToSegmentLines(clamped, rules);
  const finalLines = ruled.lines;
  const coalescedBreaks = coalesceExportParagraphBreaks(finalLines, out.breakAfterLine);
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
  return result;
}
