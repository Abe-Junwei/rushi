import { invoke } from "@tauri-apps/api/core";
import type { SegmentDto } from "./projectApi";

/** 交付 Word 形态：逐字稿（段内时间轴）/ 讲稿（连写+文首文末时码）/ 干净稿（分段+文首文末时码）。 */
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
  /**
   * 讲稿/干净稿：冻结打断时的连续块（仅多块时下发）；`unitCount` 为语段数或润色自然段数。
   */
  deliveryTimeBlocks?: Array<{
    startSec: number;
    endSec: number;
    unitCount: number;
  }> | null;
  /** 文末录音文件名称（三种形态均写；无则标签+空）。 */
  recordingFileName?: string | null;
  /**
   * 文末转录人；`null` = 省略该行（封面已写转录人）。
   * 非 null 时写 `转录人：{值}`（值可空）。
   */
  footerTranscriberName?: string | null;
  /** 文末转录时间（`YYYY-MM-DD`）；省略则不写。 */
  footerTranscribedAt?: string | null;
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
    deliveryTimeBlocks: options?.deliveryTimeBlocks ?? null,
    recordingFileName: options?.recordingFileName ?? null,
    footerTranscriberName: options?.footerTranscriberName ?? null,
    footerTranscribedAt: options?.footerTranscribedAt ?? null,
  });
}
