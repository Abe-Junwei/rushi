import type { DocxExportMode } from "../tauri/exportDocxApi";
import type { SegmentDto } from "../tauri/projectApi";
import {
  exportModeSupportsLlmPolish,
  type ExportPolishResult,
  exportPolishPreviewIsCurrent,
  resolveExportPolishBlockReason,
} from "./exportDocxPolish";
import { getExportPolishPreviewCache } from "./exportPolishPreviewCache";
import type { ExportPolishLineChange, ReconcileLlmLinesStats } from "./exportPolishPipeline";

function flattenPolishText(parts: string[]): string {
  return parts.join("").replace(/[\n\r]/g, "");
}

/** 润色自然段扁平正文须与 correctedLines 一致（与 Rust 修订轨前置条件对齐）。 */
export function assertExportPolishParagraphsAlignLines(result: ExportPolishResult): void {
  const lineFlat = flattenPolishText(result.correctedLines);
  const paraFlat = flattenPolishText(result.paragraphs);
  if (lineFlat !== paraFlat) {
    throw new Error(
      `润色段落与语段行正文不一致（${result.paragraphs.length} 段 / ${result.correctedLines.length} 行），请重新生成预览。`,
    );
  }
}

export type ExportPolishReadiness = {
  canExport: boolean;
  blockReason: string | null;
  previewCurrent: boolean;
};

/** 勾选大模型润色时：须有与当前语段指纹一致的预览或缓存。 */
export function assessExportPolishReadiness(
  segments: SegmentDto[],
  mode: DocxExportMode,
  llmPolish: boolean,
  preview: ExportPolishResult | null,
  llmBlockReason?: string | null,
): ExportPolishReadiness {
  if (!llmPolish || !exportModeSupportsLlmPolish(mode)) {
    return { canExport: true, blockReason: null, previewCurrent: false };
  }
  const block = resolveExportPolishBlockReason(segments, llmBlockReason);
  if (block) {
    return { canExport: false, blockReason: block, previewCurrent: false };
  }
  if (getExportPolishPreviewCache(segments)) {
    return { canExport: true, blockReason: null, previewCurrent: true };
  }
  if (!preview) {
    return {
      canExport: false,
      blockReason: "请先点击「生成预览」，确认修订后再导出。",
      previewCurrent: false,
    };
  }
  if (!exportPolishPreviewIsCurrent(segments, preview)) {
    return {
      canExport: false,
      blockReason: "语段正文已变更或预览已失效，请重新生成预览。",
      previewCurrent: false,
    };
  }
  return { canExport: true, blockReason: null, previewCurrent: true };
}

export type ExportPolishPreviewNotes = {
  paddedLineIndices: number[];
  noTrackChangeLineIndices: number[];
};

export function buildExportPolishPreviewNotes(
  lineChanges: ExportPolishLineChange[],
  reconcileStats?: ReconcileLlmLinesStats,
): ExportPolishPreviewNotes {
  const padded = [...(reconcileStats?.paddedLineIndices ?? [])].sort((a, b) => a - b);
  const noTrackChangeLineIndices = lineChanges
    .filter((row) => !row.hasTrackChange)
    .map((row) => row.lineIndex)
    .sort((a, b) => a - b);
  return { paddedLineIndices: padded, noTrackChangeLineIndices };
}
