import { invoke } from "@tauri-apps/api/core";
import type { SegmentDto } from "./p1Api";

export type P3DocxExportMode = "verbatim" | "lecture";

/** 另存为 DOCX；用户取消返回 `null`。 */
export async function p3ExportDocx(
  defaultFilename: string,
  title: string,
  exportMode: P3DocxExportMode,
  segments: SegmentDto[],
): Promise<string | null> {
  return invoke<string | null>("p3_export_docx", {
    defaultFilename,
    title,
    exportMode,
    segments,
  });
}
