import { invoke } from "@tauri-apps/api/core";
import type { SegmentDto } from "./projectApi";

export type DocxExportMode = "verbatim" | "lecture";

/** 另存为 DOCX；用户取消返回 `null`。 */
export async function exportDocx(
  defaultFilename: string,
  title: string,
  exportMode: DocxExportMode,
  segments: SegmentDto[],
): Promise<string | null> {
  return invoke<string | null>("export_docx", {
    defaultFilename,
    title,
    exportMode,
    segments,
  });
}
