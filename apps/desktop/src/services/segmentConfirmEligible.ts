import {
  normalizeSegmentDraftText,
  segmentDraftKey,
  segmentDraftStore,
} from "../hooks/useSegmentDraftStore";
import type { SegmentDto } from "../tauri/projectApi";
import { needsLearnOnSegmentConfirm } from "./correctionLearnBaseline";
import { segmentsWithDraftsApplied } from "./segmentDirtyRead";

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

/** 是否显示「纳入记忆」按钮（仅：聚焦后已改、尚未 ⌘/Ctrl+Enter 纳入纠错记忆）。 */
export function segmentShowConfirmLearnButton(
  segments: SegmentDto[],
  savedSnapshot: SegmentDto[],
  segmentIdx: number,
): boolean {
  if (segmentIdx < 0 || segmentIdx >= segments.length) return false;
  const live = segmentsWithDraftsApplied(segments);
  return needsLearnOnSegmentConfirm(savedSnapshot, segmentIdx, live);
}

/** 是否可响应 ⌘/Ctrl+Enter（待确认学习，或仍有未落库正文）。 */
export function segmentCanConfirmEdit(
  segments: SegmentDto[],
  savedSnapshot: SegmentDto[],
  segmentIdx: number,
): boolean {
  if (segmentIdx < 0 || segmentIdx >= segments.length) return false;
  const live = segmentsWithDraftsApplied(segments);
  if (segmentHasUnsavedText(live, savedSnapshot, segmentIdx)) return true;
  return needsLearnOnSegmentConfirm(savedSnapshot, segmentIdx, live);
}
