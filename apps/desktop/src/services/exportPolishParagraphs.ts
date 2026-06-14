/** 讲稿/干净稿润色导出：语义分段（仅版式，不进修订轨）。 */

/** 相邻分段至少间隔的语段行数。 */
const EXPORT_POLISH_MIN_LINES_PER_PARAGRAPH = 8;

/** Word 自然段上限（避免 LLM 几乎每行一分段）。 */
export const EXPORT_POLISH_MAX_PARAGRAPHS = 12;

/**
 * 合并过密的 `break_after_line`；超出上限时按语段均匀切分。
 */
export function coalesceExportParagraphBreaks(
  lineCount: number,
  breakAfterLine: number[],
): number[] {
  if (lineCount <= 1) return [];

  let breaks = [...new Set(breakAfterLine)]
    .filter((i) => i >= 0 && i < lineCount - 1)
    .sort((a, b) => a - b);

  const minGap = EXPORT_POLISH_MIN_LINES_PER_PARAGRAPH;
  const merged: number[] = [];
  let lastBreak = -minGap;
  for (const b of breaks) {
    if (b - lastBreak >= minGap) {
      merged.push(b);
      lastBreak = b;
    }
  }
  breaks = merged;

  const maxBreaks = EXPORT_POLISH_MAX_PARAGRAPHS - 1;
  if (breaks.length <= maxBreaks) {
    return breaks;
  }

  const out: number[] = [];
  for (let k = 1; k <= maxBreaks; k += 1) {
    const targetLine = Math.floor((lineCount * k) / EXPORT_POLISH_MAX_PARAGRAPHS) - 1;
    const b = Math.max(0, Math.min(lineCount - 2, targetLine));
    if (out.length === 0 || b > out[out.length - 1]) {
      out.push(b);
    }
  }
  return out;
}

export function buildParagraphsFromBreaks(
  lines: string[],
  breakAfterLine: number[],
): string[] {
  if (lines.length === 0) return [];
  const breaks = new Set(
    breakAfterLine.filter((i) => i >= 0 && i < lines.length - 1),
  );
  const out: string[] = [];
  let buf = "";
  for (let i = 0; i < lines.length; i += 1) {
    buf += lines[i] ?? "";
    if (breaks.has(i)) {
      if (buf.trim()) out.push(buf);
      buf = "";
    }
  }
  if (buf.trim()) out.push(buf);
  if (out.length === 0) {
    return [lines.join("")];
  }
  return out;
}
