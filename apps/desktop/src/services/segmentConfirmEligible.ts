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

/** ⌘/Ctrl+Enter：仅当语段正文仍有未落库修改时可保存并跳下一条。 */
export function segmentCanConfirmEdit(
  segments: SegmentDto[],
  savedSnapshot: SegmentDto[],
  segmentIdx: number,
): boolean {
  if (segmentIdx < 0 || segmentIdx >= segments.length) return false;
  return segmentHasUnsavedText(segments, savedSnapshot, segmentIdx);
}

/** 语段当前可见正文（含 draft）是否有非空白字符。 */
export function segmentHasTextContent(segments: SegmentDto[], segmentIdx: number): boolean {
  const pair = segmentTextAt(segments, segments, segmentIdx);
  if (!pair) return false;
  return pair.live.trim().length > 0;
}

export const DELETE_SEGMENT_WITH_TEXT_CONFIRM = "该语段已有正文，确定删除？";

/** 定稿（⌘Enter / 右键）：非 busy 且尚未定稿即可。 */
export function segmentCanFinalize(
  segments: SegmentDto[],
  segmentIdx: number,
  busy: boolean,
): boolean {
  if (busy) return false;
  if (segmentIdx < 0 || segmentIdx >= segments.length) return false;
  const stage = segments[segmentIdx]?.text_stage ?? "auto_transcribe";
  return stage !== "finalized";
}
