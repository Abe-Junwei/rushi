/** Hub / 导出共用：场次采集时间的存储格式（ISO 片段或自由描述，见 project-hub-metadata-research）。 */

export type RecordedAtInputMode = "month" | "date" | "text";

export type RecordedAtMonthParts = { year: string; month: string };
export type RecordedAtDateParts = { year: string; month: string; day: string };

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

export function parseRecordedAtMonthParts(value: string): RecordedAtMonthParts {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}/.test(trimmed)) {
    return { year: trimmed.slice(0, 4), month: trimmed.slice(5, 7) };
  }
  if (/^\d{1,4}$/.test(trimmed)) {
    return { year: trimmed, month: "" };
  }
  return { year: "", month: "" };
}

export function parseRecordedAtDateParts(value: string): RecordedAtDateParts {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return {
      year: trimmed.slice(0, 4),
      month: trimmed.slice(5, 7),
      day: trimmed.slice(8, 10),
    };
  }
  if (/^\d{4}-\d{2}$/.test(trimmed)) {
    return { year: trimmed.slice(0, 4), month: trimmed.slice(5, 7), day: "" };
  }
  const monthParts = parseRecordedAtMonthParts(trimmed);
  return { ...monthParts, day: "" };
}

function sanitizeYearInput(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 4);
}

function sanitizeTwoDigitPart(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 2);
}

function padMonthOrDay(twoDigit: string): string | null {
  if (twoDigit.length === 0) return null;
  const padded = twoDigit.length === 1 ? `0${twoDigit}` : twoDigit;
  return /^\d{2}$/.test(padded) ? padded : null;
}

/** Compose month field edits; allows in-progress year typing before month is chosen. */
export function formatRecordedAtMonth(year: string, month: string): string {
  const y = sanitizeYearInput(year);
  const m = sanitizeTwoDigitPart(month);
  if (!y && !m) return "";
  if (y.length === 4 && m) {
    const mm = padMonthOrDay(m);
    if (mm && Number(mm) >= 1 && Number(mm) <= 12) return `${y}-${mm}`;
  }
  if (y.length > 0 && y.length < 4) return y;
  if (y.length === 4 && !m) return y;
  return "";
}

/** Compose date field edits; requires YYYY-MM-DD when day is set. */
export function formatRecordedAtDate(year: string, month: string, day: string): string {
  const y = sanitizeYearInput(year);
  const m = sanitizeTwoDigitPart(month);
  const d = sanitizeTwoDigitPart(day);
  if (!y && !m && !d) return "";
  if (y.length === 4 && m && d) {
    const mm = padMonthOrDay(m);
    const dd = padMonthOrDay(d);
    if (!mm || !dd) return formatRecordedAtMonth(y, m);
    if (Number(mm) >= 1 && Number(mm) <= 12 && Number(dd) >= 1 && Number(dd) <= 31) {
      return `${y}-${mm}-${dd}`;
    }
  }
  const monthPartial = formatRecordedAtMonth(y, m);
  if (monthPartial && !d) return monthPartial;
  if (y.length > 0 && y.length < 4) return y;
  if (y.length === 4 && !m) return y;
  return monthPartial;
}

export function normalizeRecordedAtForSave(value: string | null | undefined): string {
  return (value ?? "").trim();
}
