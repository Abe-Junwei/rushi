import type { SegmentDto } from "../tauri/projectApi";

/** 语段行间分隔（ASCII RS）；语段内 `\n` 保留，避免与 `\n` 拼接歧义。 */
export const EXPORT_POLISH_LINE_SEPARATOR = "\u001e";

/** 润色 LLM 输入：按语段顺序拼接，段间 RS。 */
export function joinExportPolishLines(lines: string[]): string {
  return lines.join(EXPORT_POLISH_LINE_SEPARATOR);
}

/** 润色 LLM 输入：按语段顺序拼接，段间 RS。 */
export function joinSegmentTextsForExportPolish(segments: SegmentDto[]): string {
  return segments
    .map((s) => (s.text ?? "").trim())
    .filter((t) => t.length > 0)
    .join(EXPORT_POLISH_LINE_SEPARATOR);
}

/** 与非空导出语段一一对应的全局稳定键；缺 uid/重复 uid 时使用导出快照键。 */
export function exportPolishSnapshotUids(segments: SegmentDto[]): string[] {
  const rows = segments.filter((segment) => (segment.text ?? "").trim().length > 0);
  const seen = new Set<string>();
  return rows.map((segment, position) => {
    const uid = segment.uid?.trim() ?? "";
    if (uid && !seen.has(uid)) {
      seen.add(uid);
      return uid;
    }
    let snapshotUid = `export-snapshot:${position}:${segment.idx}`;
    while (seen.has(snapshotUid)) snapshotUid = `${snapshotUid}:fallback`;
    seen.add(snapshotUid);
    return snapshotUid;
  });
}

/** 与 Rust `lines_from_export_polish_body` 对齐。 */
export function splitExportPolishJoinedBody(body: string): string[] {
  if (!body) return [];
  if (body.includes(EXPORT_POLISH_LINE_SEPARATOR)) {
    return body.split(EXPORT_POLISH_LINE_SEPARATOR).map((s) => s.trim());
  }
  return body
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** 与 Rust `str::chars().count()` 对齐（非 UTF-16 code units）。 */
export function countUnicodeScalars(text: string): number {
  return [...text].length;
}
