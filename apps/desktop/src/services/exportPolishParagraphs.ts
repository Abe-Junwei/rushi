/** 讲稿/干净稿润色导出：语义分段（仅版式，不进修订轨）。 */

import { graphemeCount } from "./text/grapheme";

/** Word 自然段建议上限（字素）；超过则在语段边界强制切开。 */
export const EXPORT_POLISH_MAX_PARAGRAPH_GRAPHEMES = 300;

/** 过短自然段阈值：语义断点若使本段不足此字数，则并入下一段（强制切分除外）。 */
const EXPORT_POLISH_MIN_PARAGRAPH_GRAPHEMES = 40;

/**
 * 合并过碎的语义断点，并按字数上限切开过长自然段。
 * 断点均在语段行边界（行下标之后）。
 */
export function coalesceExportParagraphBreaks(
  lines: string[],
  breakAfterLine: number[],
): number[] {
  const lineCount = lines.length;
  if (lineCount <= 1) return [];

  const semantic = new Set(
    [...new Set(breakAfterLine)].filter((i) => i >= 0 && i < lineCount - 1),
  );

  const breaks: number[] = [];
  let paraLen = 0;

  for (let i = 0; i < lineCount - 1; i += 1) {
    paraLen += graphemeCount(lines[i] ?? "");
    const nextLen = graphemeCount(lines[i + 1] ?? "");
    const wouldExceed =
      paraLen > 0 && paraLen + nextLen > EXPORT_POLISH_MAX_PARAGRAPH_GRAPHEMES;
    const wantSemantic = semantic.has(i);

    if (!wouldExceed && !wantSemantic) continue;
    if (wantSemantic && !wouldExceed && paraLen < EXPORT_POLISH_MIN_PARAGRAPH_GRAPHEMES) {
      continue;
    }

    breaks.push(i);
    paraLen = 0;
  }

  return breaks;
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
