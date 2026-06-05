import type { CorrectionHighlightSpan } from "./segmentCorrectionRulesApply";
import { splitGraphemes } from "../text/grapheme";

/** 将字素高亮区间转为 JS 字符串索引，供语段列表 `FindReplaceMatchText` / `setSelectionRange` 使用。 */
export function correctionHighlightSpanToCharRange(
  text: string,
  span: CorrectionHighlightSpan | undefined,
): { charStart: number; charEnd: number } | null {
  if (!span) return null;
  const glyphs = splitGraphemes(text);
  const startG = Math.max(0, Math.min(span.startG, glyphs.length));
  const endG = Math.max(startG, Math.min(span.endG, glyphs.length));
  const charStart = glyphs.slice(0, startG).join("").length;
  const charEnd = glyphs.slice(0, endG).join("").length;
  if (charStart === charEnd) return null;
  return { charStart, charEnd };
}
