import type { TextInputDomSnapshot } from "./learnEditDelta";

/** CJK 选区 + 拉丁拼音首击：等 compositionEnd 再记 op，避免 视死→s 污染追踪。 */
export function shouldDeferDomInputForIme(
  snap: TextInputDomSnapshot,
  valueAfter: string,
): boolean {
  const selLen = Math.max(0, snap.end - snap.start);
  if (selLen === 0 || snap.value === valueAfter) return false;
  const removed = snap.value.slice(snap.start, snap.end);
  if (!/[\u4e00-\u9fff]/.test(removed)) return false;
  const insertedLen = valueAfter.length - snap.value.length + selLen;
  if (insertedLen <= 0) return false;
  const inserted = valueAfter.slice(snap.start, snap.start + insertedLen);
  return inserted.length > 0 && /^[\x20-\x7E]+$/.test(inserted);
}
