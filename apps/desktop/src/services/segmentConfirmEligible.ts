import {
  normalizeSegmentDraftText,
  segmentDraftKey,
  segmentDraftStore,
} from "../hooks/useSegmentDraftStore";
import type { SegmentDto } from "../tauri/projectApi";

function segmentTextAt(
  segments: SegmentDto[],
  savedSnapshot: SegmentDto[],
  idx: number,
): { live: string; saved: string } | null {
  const liveSeg = segments[idx];
  if (!liveSeg) return null;
  const uid = liveSeg.uid?.trim();
  const key = segmentDraftKey(liveSeg, idx);
  const draft = segmentDraftStore.getDraft(key);
  const live = normalizeSegmentDraftText(draft ?? liveSeg.text ?? "");
  const savedSeg = uid
    ? savedSnapshot.find((s) => s.uid?.trim() === uid)
    : savedSnapshot[idx];
  const saved = normalizeSegmentDraftText(savedSeg?.text ?? "");
  return { live, saved };
}

export function segmentHasUnsavedText(
  segments: SegmentDto[],
  savedSnapshot: SegmentDto[],
  segmentIdx: number,
): boolean {
  const pair = segmentTextAt(segments, savedSnapshot, segmentIdx);
  if (!pair) return false;
  return pair.live !== pair.saved;
}

/** @deprecated 改用语段选区右键「纳入更正记忆」。 */
export function segmentShowConfirmLearnButton(
  _segments: SegmentDto[],
  _savedSnapshot: SegmentDto[],
  _segmentIdx: number,
): boolean {
  return false;
}

/** ⌘/Ctrl+Enter：仅当语段正文仍有未落库修改时可保存并跳下一条。 */
export function segmentCanConfirmEdit(
  segments: SegmentDto[],
  savedSnapshot: SegmentDto[],
  segmentIdx: number,
): boolean {
  if (segmentIdx < 0 || segmentIdx >= segments.length) return false;
  return segmentHasUnsavedText(segments, savedSnapshot, segmentIdx);
}
