import type { DocxExportMode } from "../tauri/exportDocxApi";
import type { SegmentDto } from "../tauri/projectApi";
import {
  exportWantsLlmPolish,
  resolveExportPolishBlockReason,
  type ExportPolishResult,
} from "./exportDocxPolish";

function flattenPolishText(parts: string[]): string {
  return parts.join("").replace(/[\n\r]/g, "");
}

/** 润色自然段扁平正文须与 correctedLines 一致（与 Rust 修订轨前置条件对齐）。 */
export function assertExportPolishParagraphsAlignLines(result: ExportPolishResult): void {
  const lineFlat = flattenPolishText(result.correctedLines);
  const paraFlat = flattenPolishText(result.paragraphs);
  if (lineFlat !== paraFlat) {
    throw new Error(
      `润色段落与语段行正文不一致（${result.paragraphs.length} 段 / ${result.correctedLines.length} 行），请重试导出。`,
    );
  }
}

export type ExportPolishReadiness = {
  canExport: boolean;
  blockReason: string | null;
};

/** 勾选大模型润色时：仅检查 LLM/正文前置条件（导出时再请求模型，无需预览）。 */
export function assessExportPolishReadiness(
  segments: SegmentDto[],
  mode: DocxExportMode,
  llmPolish: boolean,
  llmBlockReason?: string | null,
): ExportPolishReadiness {
  if (!exportWantsLlmPolish(mode, llmPolish)) {
    return { canExport: true, blockReason: null };
  }
  const block = resolveExportPolishBlockReason(segments, llmBlockReason);
  if (block) {
    return { canExport: false, blockReason: block };
  }
  return { canExport: true, blockReason: null };
}
