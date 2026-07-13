/** Hub / 导出共用：场次采集时间（ISO 片段或自由描述，见 project-hub-metadata-research）。 */

/**
 * 输入框唯一示例占位（成熟产品：空态只暗示规范格式，说明不堆字段下）。
 * 调研：docs/execution/specs/project-recorded-at-input-ux-research.md
 */
export const RECORDED_AT_PLACEHOLDER = "2024-03-15";

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function isValidYmd(y: number, m?: number, d?: number): boolean {
  if (!Number.isInteger(y) || y < 1 || y > 9999) return false;
  if (m == null) return true;
  if (!Number.isInteger(m) || m < 1 || m > 12) return false;
  if (d == null) return true;
  if (!Number.isInteger(d) || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function formatCanonical(y: number, m?: number, d?: number): string | null {
  if (!isValidYmd(y, m, d)) return null;
  if (m == null) return String(y);
  if (d == null) return `${y}-${pad2(m)}`;
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

/** 明显近似/叙述性时间：不强制改写成 ISO。 */
function looksLikeApproximateDescription(raw: string): boolean {
  return /约|大概|左右|前后|年代|世纪|上旬|中旬|下旬|春|夏|秋|冬|月初|月末/.test(raw);
}

/**
 * 将常见日期写法规范为 `YYYY` / `YYYY-MM` / `YYYY-MM-DD`；
 * 无法安全解析则仅 trim（保留口述史近似描述）。
 */
export function normalizeRecordedAtInput(value: string | null | undefined): string {
  const trimmed = (value ?? "").trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  if (looksLikeApproximateDescription(trimmed)) return trimmed;

  // Already canonical ISO fragment.
  const iso = trimmed.match(/^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/);
  if (iso) {
    const y = Number(iso[1]);
    const m = iso[2] != null ? Number(iso[2]) : undefined;
    const d = iso[3] != null ? Number(iso[3]) : undefined;
    return formatCanonical(y, m, d) ?? trimmed;
  }

  // 2024年3月15日 / 2024年3月 / 2024年
  const zh = trimmed.match(/^(\d{4})\s*年(?:\s*(\d{1,2})\s*月(?:\s*(\d{1,2})\s*日?)?)?$/);
  if (zh) {
    const y = Number(zh[1]);
    const m = zh[2] != null ? Number(zh[2]) : undefined;
    const d = zh[3] != null ? Number(zh[3]) : undefined;
    return formatCanonical(y, m, d) ?? trimmed;
  }

  // 2024/3/15 · 2024.3.15 · 2024-3-5（月日可一位）
  const sep = trimmed.match(/^(\d{4})[/.-](\d{1,2})(?:[/.-](\d{1,2}))?$/);
  if (sep) {
    const y = Number(sep[1]);
    const m = Number(sep[2]);
    const d = sep[3] != null ? Number(sep[3]) : undefined;
    return formatCanonical(y, m, d) ?? trimmed;
  }

  // 2024/3 · 2024.3
  const ym = trimmed.match(/^(\d{4})[/.-](\d{1,2})$/);
  if (ym) {
    return formatCanonical(Number(ym[1]), Number(ym[2])) ?? trimmed;
  }

  return trimmed;
}

/** 保存路径：与失焦规范化同一套规则。 */
export function normalizeRecordedAtForSave(value: string | null | undefined): string {
  return normalizeRecordedAtInput(value);
}
