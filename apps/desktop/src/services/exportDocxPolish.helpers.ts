import type { SegmentDto } from "../tauri/projectApi";

/** 润色 LLM 输入：按语段顺序拼接，段间单换行。 */
export function joinSegmentTextsForExportPolish(segments: SegmentDto[]): string {
  return segments
    .map((s) => (s.text ?? "").trim())
    .filter((t) => t.length > 0)
    .join("\n");
}

/** 与 Rust `str::chars().count()` 对齐（非 UTF-16 code units）。 */
export function countUnicodeScalars(text: string): number {
  return [...text].length;
}
