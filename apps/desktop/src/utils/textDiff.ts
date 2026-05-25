export interface TextDiffSpan {
  start: number;
  end: number;
  kind: "insert" | "delete" | "replace";
}

/**
 * 计算单段文本的最小单区间差异。
 * `start/end` 以候选文本 `after` 的索引为准；删除时为零宽区间。
 */
export function computeSingleTextDiff(before: string, after: string): TextDiffSpan[] {
  if (before === after) return [];

  let prefix = 0;
  while (
    prefix < before.length &&
    prefix < after.length &&
    before[prefix] === after[prefix]
  ) {
    prefix += 1;
  }

  let beforeSuffix = before.length;
  let afterSuffix = after.length;
  while (
    beforeSuffix > prefix &&
    afterSuffix > prefix &&
    before[beforeSuffix - 1] === after[afterSuffix - 1]
  ) {
    beforeSuffix -= 1;
    afterSuffix -= 1;
  }

  const removed = beforeSuffix - prefix;
  const inserted = afterSuffix - prefix;
  const kind =
    removed === 0 ? "insert" : inserted === 0 ? "delete" : "replace";

  return [{ start: prefix, end: afterSuffix, kind }];
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
