import { invoke } from "@tauri-apps/api/core";
import type { SegmentDto } from "./projectApi";

/** 交付 Word 形态：逐字稿（时间轴）/ 讲稿（连写）/ 干净稿（分句无时间轴、无低置信标记）。 */
export type DocxExportMode = "verbatim" | "lecture" | "clean";

export type DocxExportOptions = {
  /** 文档副标题行（导出时间等）。 */
  exportMetaLine?: string;
  /** 附录：修订摘要纯文本行。 */
  appendixLines?: string[];
  /** 讲稿/干净稿 + 大模型润色后的段落（优先于按语段分段）。 */
  polishedParagraphs?: string[];
  /** 润色前正文（与送入 LLM 的 `joinSegmentTextsForExportPolish` 结果一致）。 */
  polishBeforeJoined?: string;
  /** 与语段一一对应的错字/标点修正行（修订轨真源）。 */
  polishCorrectedLines?: string[];
  /** 为 true 且有成对润色段落时，正文以 Track Changes 呈现并开启 `trackRevisions`。 */
  polishTrackChanges?: boolean;
};

/** 另存为 DOCX；用户取消返回 `null`。 */
export async function exportDocx(
  defaultFilename: string,
  title: string,
  exportMode: DocxExportMode,
  segments: SegmentDto[],
  options?: DocxExportOptions,
): Promise<string | null> {
  return invoke<string | null>("export_docx", {
    defaultFilename,
    title,
    exportMode,
    segments,
    exportMetaLine: options?.exportMetaLine ?? null,
    appendixLines: options?.appendixLines ?? [],
    polishedParagraphs: options?.polishedParagraphs ?? null,
    polishBeforeJoined: options?.polishBeforeJoined ?? null,
    polishCorrectedLines: options?.polishCorrectedLines ?? null,
    polishTrackChanges: options?.polishTrackChanges ?? null,
  });
}
