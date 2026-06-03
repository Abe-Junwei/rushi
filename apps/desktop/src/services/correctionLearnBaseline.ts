import { normalizeSegmentDraftText, segmentDraftKey, segmentDraftStore } from "../hooks/useSegmentDraftStore";
import type { SegmentDto } from "../tauri/projectApi";
export type LearnBaselineText = { uid: string; text: string };

/** @deprecated 自动 learnEdit 追踪已弃用；纳入记忆改由右键手动指定。 */
export function segmentPendingLearnAtIndex(_segment: SegmentDto, _segmentIdx: number): boolean {
  return false;
}

/** 自动追踪已弃用；保存语段不再附带 explicit_pairs 推断。 */
export function needsLearnOnSegmentConfirm(
  _savedSegments: SegmentDto[],
  _segmentIdx: number,
  _liveSegments: SegmentDto[],
): boolean {
  return false;
}

export function buildConfirmLearnBaseline(
  savedSegments: SegmentDto[],
  segmentIdx: number,
  liveSegments: SegmentDto[],
): LearnBaselineText[] {
  const confirmSeg = liveSegments[segmentIdx];
  const confirmKey = confirmSeg ? segmentDraftKey(confirmSeg, segmentIdx) : null;
  const focusBase = confirmKey ? segmentDraftStore.getLearnFocusBaseline(confirmKey) : undefined;
  const out: LearnBaselineText[] = [];
  for (let i = 0; i < savedSegments.length; i++) {
    const seg = savedSegments[i];
    const uid = seg?.uid?.trim();
    if (!seg || !uid) continue;
    const text =
      i === segmentIdx && focusBase !== undefined ? focusBase : normalizeSegmentDraftText(seg.text ?? "");
    out.push({ uid, text });
  }
  return out;
}

/** Snapshot texts used for correction memory baseline (before this save). */
export function segmentsToLearnBaseline(segments: SegmentDto[]): LearnBaselineText[] {
  const out: LearnBaselineText[] = [];
  for (const seg of segments) {
    const uid = seg.uid?.trim();
    if (!uid) continue;
    out.push({ uid, text: seg.text });
  }
  return out;
}
