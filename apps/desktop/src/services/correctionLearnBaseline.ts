import { normalizeSegmentDraftText, segmentDraftKey, segmentDraftStore } from "../hooks/useSegmentDraftStore";
import type { SegmentDto } from "../tauri/projectApi";
import { collectLearnablePairsForSession } from "./learnEditDelta";

export type LearnBaselineText = { uid: string; text: string };

function learnablePairsAtKey(key: string, segment: SegmentDto) {
  const focusBase = segmentDraftStore.getLearnFocusBaseline(key);
  if (focusBase === undefined) return [];
  const draft = segmentDraftStore.getDraft(key);
  const liveText = normalizeSegmentDraftText(draft ?? segment.text ?? "");
  const learnState = segmentDraftStore.getLearnEditState(key);
  return collectLearnablePairsForSession(learnState, focusBase, liveText);
}

/** 单语段：有 beforeinput 追踪且产出可学习词条对。 */
export function segmentPendingLearnAtIndex(segment: SegmentDto, segmentIdx: number): boolean {
  const key = segmentDraftKey(segment, segmentIdx);
  return learnablePairsAtKey(key, segment).length > 0;
}

/** 聚焦时记下基线后，⌘/Ctrl+Enter 仍可按「改前」学习（须有可学习追踪对）。 */
export function needsLearnOnSegmentConfirm(
  _savedSegments: SegmentDto[],
  segmentIdx: number,
  liveSegments: SegmentDto[],
): boolean {
  const seg = liveSegments[segmentIdx];
  if (!seg) return false;
  return segmentPendingLearnAtIndex(seg, segmentIdx);
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
