/**
 * Join texts when merging segments.
 * Never insert `\n` — CM6 one-line-per-segment encodes it as visible U+240A (␊).
 * CJK abutting → no separator; otherwise a single space.
 */
export function joinMergedSegmentTexts(a: string, b: string): string {
  const left = (a ?? "").replace(/\s+$/u, "");
  const right = (b ?? "").replace(/^\s+/u, "");
  if (!left) return right;
  if (!right) return left;
  const noSpace =
    /[\u3040-\u9fff\uf900-\ufaff\u3000-\u303f\uff00-\uffef]$/u.test(left) ||
    /^[\u3040-\u9fff\uf900-\ufaff\u3000-\u303f\uff00-\uffef]/u.test(right);
  return noSpace ? `${left}${right}` : `${left} ${right}`;
}
