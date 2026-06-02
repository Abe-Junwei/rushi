export interface TextDiffSpan {
  start: number;
  end: number;
  kind: "insert" | "delete" | "replace";
}

import {
  graphemeIndexToCodeUnitOffset,
  sliceGraphemes,
  splitGraphemes,
} from "../services/text/grapheme";

/**
 * 计算单段文本的最小单区间差异（字素级对齐，索引仍映射到 UTF-16 供 textarea 使用）。
 */
function singleTextDiffBounds(before: string, after: string) {
  const bGlyphs = splitGraphemes(before);
  const aGlyphs = splitGraphemes(after);

  let prefixG = 0;
  while (
    prefixG < bGlyphs.length &&
    prefixG < aGlyphs.length &&
    bGlyphs[prefixG] === aGlyphs[prefixG]
  ) {
    prefixG += 1;
  }

  let beforeEndG = bGlyphs.length;
  let afterEndG = aGlyphs.length;
  while (
    beforeEndG > prefixG &&
    afterEndG > prefixG &&
    bGlyphs[beforeEndG - 1] === aGlyphs[afterEndG - 1]
  ) {
    beforeEndG -= 1;
    afterEndG -= 1;
  }

  const prefix = graphemeIndexToCodeUnitOffset(after, prefixG);
  const afterSuffix = graphemeIndexToCodeUnitOffset(after, afterEndG);
  const removedLen = beforeEndG - prefixG;
  const insertedLen = afterEndG - prefixG;
  const kind =
    removedLen === 0 ? ("insert" as const) : insertedLen === 0 ? ("delete" as const) : ("replace" as const);

  return { prefix, afterSuffix, kind, prefixG, beforeEndG, afterEndG, before, after };
}

export function computeSingleTextDiff(before: string, after: string): TextDiffSpan[] {
  if (before === after) return [];
  const { prefix, afterSuffix, kind } = singleTextDiffBounds(before, after);
  return [{ start: prefix, end: afterSuffix, kind }];
}

/** 聚焦基线 vs 当前草稿：用于待纳入记忆的删改展示与显式学习对。 */
export type SingleTextDiffParts = {
  prefix: string;
  removed: string;
  inserted: string;
  suffix: string;
  kind: TextDiffSpan["kind"];
};

export function extractSingleTextDiffParts(
  before: string,
  after: string,
): SingleTextDiffParts | null {
  if (before === after) return null;
  const bounds = singleTextDiffBounds(before, after);
  return {
    prefix: sliceGraphemes(after, 0, bounds.prefixG),
    removed: sliceGraphemes(bounds.before, bounds.prefixG, bounds.beforeEndG),
    inserted: sliceGraphemes(bounds.after, bounds.prefixG, bounds.afterEndG),
    suffix: sliceGraphemes(bounds.after, bounds.afterEndG),
    kind: bounds.kind,
  };
}

export function highlightTextByDiff(
  text: string,
  diff: TextDiffSpan[],
): { text: string; highlight: boolean }[] {
  if (diff.length === 0) return [{ text, highlight: false }];
  const [{ start, end, kind }] = diff;
  if (kind === "delete" || start >= end) return [{ text, highlight: false }];
  return [
    { text: text.slice(0, start), highlight: false },
    { text: text.slice(start, end), highlight: true },
    { text: text.slice(end), highlight: false },
  ].filter((x) => x.text.length > 0);
}
