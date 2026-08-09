import type { DocxExportMode } from "../tauri/exportDocxApi";
import type { SegmentDto } from "../tauri/projectApi";
import {
  postprocessExportPolish,
  type PostprocessExportPolishRequest,
} from "../tauri/postprocessApi";
import { countUnicodeScalars } from "./exportDocxPolish.helpers";
import { exportPolishSnapshotUids } from "./exportDocxPolish.helpers";
import {
  isLocalLoopbackLlmConfig,
  llmConfigHint,
  tryBuildPostprocessRuntimeBridge,
} from "./postprocess/postprocessRuntimeContract";
import { correctionStableRulesList } from "../tauri/correctionApi";
import { glossaryList } from "../tauri/glossaryApi";
import {
  applyRulesToSegmentLines,
  applyPunctuationOnlyExportPolish,
  buildExportPolishLineChanges,
  exportPolishLinesPreserveTrustedContent,
  joinLinesForLlmBody,
  segmentLinesFromSegments,
  type ExportPolishLineChange,
  type ReconcileLlmLinesStats,
} from "./exportPolishPipeline";
import { assertExportPolishParagraphsAlignLines } from "./exportPolishDelivery";
import { buildExportPolishRuleHints } from "./exportPolishRuleHints";
import { buildExportPolishGlossaryHints } from "./exportPolishGlossaryHints";
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
  strategy: "fidelity" | "lecture_optimize";
  /** 本次实际请求使用的模型名，用作 Word 修订作者。 */
  model?: string;
  protocolStats?: {
    omittedUnchanged: number;
    invalidEdits: number;
    unknownUids: number;
    duplicateUids: number;
    emptyEdits: number;
    malformedEdits: number;
    contextEchoEdits: number;
    invalidBreakUids: number;
    legacyResponse: boolean;
    sparseResponse: boolean;
    retriedEdits: number;
    recoveredEdits: number;
  };
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

/** 保真整理与讲稿优化都必须走对应的 LLM 任务。 */
export function exportModeRequiresLlmPolish(mode: DocxExportMode): boolean {
  return mode === "clean" || mode === "lecture";
}

export function exportWantsLlmPolish(mode: DocxExportMode, _llmPolish: boolean): boolean {
  return exportModeRequiresLlmPolish(mode);
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
  const [rules, glossaryTerms] = await Promise.all([correctionStableRulesList(), glossaryList()]);
  const ruleHints = buildExportPolishRuleHints(rules);
  const glossaryHints = buildExportPolishGlossaryHints(glossaryTerms);
  // 本地规则是唯一可信的正文改写源；LLM 只在此基线上调整标点与分段。
  const ruled = applyRulesToSegmentLines(beforeLines, rules);
  const trustedLines = ruled.lines;
  const body = joinLinesForLlmBody(trustedLines);

  const req: PostprocessExportPolishRequest = {
    task: "export_polish",
    requestId: options?.requestId,
    body,
    lineCount: beforeLines.length,
    runtime,
    ruleHints: ruleHints.trim() || undefined,
    glossaryHints: glossaryHints.trim() || undefined,
  };
  const out = await postprocessExportPolish(req);

  if (out.punctLines.length === 0) {
    throw new Error("模型未返回 items（标点项），请重试。");
  }
  const gated = applyPunctuationOnlyExportPolish(
    trustedLines,
    out.punctLines,
    out.contentContractValid,
    out.contractFallbackLineIndices ?? [],
  );
  const invariantFallback = !exportPolishLinesPreserveTrustedContent(trustedLines, gated.lines);
  const finalLines = invariantFallback ? [...trustedLines] : gated.lines;
  const contractFallbackLineIndices = invariantFallback
    ? trustedLines.map((_, index) => index)
    : gated.contractFallbackLineIndices;
  const revertedContentLineIndices = invariantFallback
    ? []
    : gated.revertedContentLineIndices;
  const paddedLineIndices = [
    ...new Set([...contractFallbackLineIndices, ...revertedContentLineIndices]),
  ].sort((a, b) => a - b);
  const reconcileStats: ReconcileLlmLinesStats = {
    llmCount: out.punctLines.length,
    segmentCount: trustedLines.length,
    paddedFromBefore: paddedLineIndices.length,
    mergedSegmentPairs: 0,
    paddedLineIndices,
  };
  const coalescedBreaks = coalesceExportParagraphBreaks(finalLines, out.breakAfterLine);
  const paragraphs = buildParagraphsFromBreaks(finalLines, coalescedBreaks);
  if (paragraphs.length === 0) {
    throw new Error("无法生成语义自然段，请重试。");
  }

  const lineChanges = buildExportPolishLineChanges(beforeLines, finalLines);
  const diagnostic = buildExportPolishDiagnosticSummary({
    beforeLines,
    trustedLines,
    llmLines: out.punctLines,
    lineChanges,
    rejectedLineIndices: paddedLineIndices,
    rules,
  });
  let diagnosticHint = formatExportPolishDiagnosticHint(diagnostic);
  if (contractFallbackLineIndices.length > 0) {
    const note = `${contractFallbackLineIndices.length} 行所在批次的模型 ID/结构异常，正文已安全回退`;
    diagnosticHint = diagnosticHint ? `${diagnosticHint}；${note}` : note;
  }
  if (revertedContentLineIndices.length > 0) {
    const note = `${revertedContentLineIndices.length} 行包含模型正文删改，已回退可信正文`;
    diagnosticHint = diagnosticHint ? `${diagnosticHint}；${note}` : note;
  }
  if (invariantFallback) {
    const note = "最终正文完整性断言未通过，整稿已回退可信正文";
    diagnosticHint = diagnosticHint ? `${diagnosticHint}；${note}` : note;
  }
  if (reconcileStats.llmCount !== reconcileStats.segmentCount) {
    const alignNote = `模型返回 ${reconcileStats.llmCount} 项、语段 ${reconcileStats.segmentCount} 行，正文已整稿回退可信内容`;
    diagnosticHint = diagnosticHint ? `${diagnosticHint}；${alignNote}` : alignNote;
  }

  const segmentsFingerprint = fingerprintExportPolishSegments(segments);
  const result: ExportPolishResult = {
    strategy: "fidelity",
    model: runtime.model.trim() || undefined,
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

/** 讲稿优化：稳定 uid 稀疏 edits，正文改写全部进入 Word 修订轨。 */
export async function fetchExportLectureOptimizeResult(
  segments: SegmentDto[],
  options?: { requestId?: string },
): Promise<ExportPolishResult> {
  const block = resolveExportPolishBlockReason(segments);
  if (block) throw new Error(block);
  const runtime = tryBuildPostprocessRuntimeBridge();
  if (!runtime) throw new Error("LLM 未配置。");

  const beforeLines = segmentLinesFromSegments(segments);
  const lineUids = exportPolishSnapshotUids(segments);
  const [rules, glossaryTerms] = await Promise.all([correctionStableRulesList(), glossaryList()]);
  const body = joinLinesForLlmBody(beforeLines);
  const out = await postprocessExportPolish({
    task: "export_lecture_optimize",
    requestId: options?.requestId,
    body,
    lineCount: beforeLines.length,
    lineUids,
    runtime,
    ruleHints: buildExportPolishRuleHints(rules).trim() || undefined,
    glossaryHints: buildExportPolishGlossaryHints(glossaryTerms).trim() || undefined,
  });

  const structurallyValid =
    out.punctLines.length === beforeLines.length && out.punctLines.every((line) => line.trim().length > 0);
  const declaredFallbackIndices = [...new Set(out.contractFallbackLineIndices ?? [])]
    .filter((index) => Number.isInteger(index) && index >= 0 && index < beforeLines.length)
    .sort((a, b) => a - b);
  const fallbackIndices =
    !structurallyValid || (!out.contentContractValid && declaredFallbackIndices.length === 0)
      ? beforeLines.map((_, index) => index)
      : declaredFallbackIndices;
  const fallbackSet = new Set(fallbackIndices);
  const finalLines = structurallyValid
    ? out.punctLines.map((line, index) => (fallbackSet.has(index) ? (beforeLines[index] ?? "") : line))
    : [...beforeLines];
  const breaks = coalesceExportParagraphBreaks(finalLines, out.breakAfterLine);
  const paragraphs = buildParagraphsFromBreaks(finalLines, breaks);
  if (paragraphs.length === 0) throw new Error("无法生成讲稿优化修订稿，请重试。");

  const lineChanges = buildExportPolishLineChanges(beforeLines, finalLines);
  const diagnostic = buildExportPolishDiagnosticSummary({
    beforeLines,
    trustedLines: beforeLines,
    llmLines: out.punctLines,
    lineChanges,
    rejectedLineIndices: fallbackIndices,
    rules: [],
  });
  const fallbackNote =
    fallbackIndices.length > 0 ? `${fallbackIndices.length} 条 edit 无法安全采用，已保留对应原文` : null;
  const protocolNotes: string[] = [];
  if (out.protocolStats?.invalidEdits) {
    protocolNotes.push(`模型返回 ${out.protocolStats.invalidEdits} 条无效 edit，已逐条隔离`);
  }
  if (out.protocolStats?.contextEchoEdits) {
    protocolNotes.push(
      `检测到 ${out.protocolStats.contextEchoEdits} 次邻段内容复述，已拦截`,
    );
  }
  if (out.protocolStats?.retriedEdits) {
    protocolNotes.push(
      `${out.protocolStats.retriedEdits} 条已定点重试，${out.protocolStats.recoveredEdits} 条得到安全结果`,
    );
  }
  if (out.protocolStats?.legacyResponse) {
    protocolNotes.push("模型返回旧版完整 items，已通过兼容层安全转换");
  }
  const result: ExportPolishResult = {
    strategy: "lecture_optimize",
    model: runtime.model.trim() || undefined,
    paragraphs,
    correctedLines: finalLines,
    lineChanges,
    breakAfterLine: breaks,
    diagnostic,
    diagnosticHint: [fallbackNote, ...protocolNotes].filter(Boolean).join("；") || null,
    protocolStats: out.protocolStats,
    segmentsFingerprint: fingerprintExportPolishSegments(segments),
    reconcileStats: {
      llmCount: out.punctLines.length,
      segmentCount: beforeLines.length,
      paddedFromBefore: fallbackIndices.length,
      mergedSegmentPairs: 0,
      paddedLineIndices: fallbackIndices,
    },
  };
  assertExportPolishParagraphsAlignLines(result);
  return result;
}
