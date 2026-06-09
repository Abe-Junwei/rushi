/** Hub / 导出共用：场次采集时间的存储格式（ISO 片段或自由描述，见 project-hub-metadata-research）。 */

export type RecordedAtInputMode = "month" | "date" | "text";

export function detectRecordedAtMode(value: string): RecordedAtInputMode {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return "date";
  if (/^\d{4}-\d{2}$/.test(trimmed)) return "month";
  return "text";
}

/** 切换输入模式时，尽量保留已有语义。 */
export function recordedAtValueForMode(value: string, mode: RecordedAtInputMode): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (mode === "month") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed.slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(trimmed)) return trimmed;
    return "";
  }
  if (mode === "date") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    if (/^\d{4}-\d{2}$/.test(trimmed)) return `${trimmed}-01`;
    return "";
  }
  return trimmed;
}

export function normalizeRecordedAtForSave(value: string | null | undefined): string {
  return (value ?? "").trim();
}
