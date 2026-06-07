import type { SegmentDto } from "../tauri/projectTypes";
import { mergeTwoSegments } from "../pages/segmentListHelpers";
import { selectPackableSegmentIndices } from "./waveformSegmentBounds";

export type SegmentSelectionState = {
  anchorIdx: number;
  focusIdx: number;
};

export function clampSegmentIndex(idx: number, segmentCount: number): number {
  if (segmentCount <= 0) return 0;
  return Math.max(0, Math.min(idx, segmentCount - 1));
}

export function normalizeSegmentIndexRange(
  anchor: number,
  focus: number,
  segmentCount: number,
): { lo: number; hi: number } | null {
  if (segmentCount <= 0) return null;
  const lo = clampSegmentIndex(Math.min(anchor, focus), segmentCount);
  const hi = clampSegmentIndex(Math.max(anchor, focus), segmentCount);
  return { lo, hi };
}

export function resolveSegmentSelectionRange(
  selection: SegmentSelectionState | null,
  selectedIdx: number,
  segmentCount: number,
): { lo: number; hi: number; count: number } | null {
  if (segmentCount <= 0) return null;
  if (selection) {
    const range = normalizeSegmentIndexRange(selection.anchorIdx, selection.focusIdx, segmentCount);
    if (!range) return null;
    return { ...range, count: range.hi - range.lo + 1 };
  }
  const idx = clampSegmentIndex(selectedIdx, segmentCount);
  return { lo: idx, hi: idx, count: 1 };
}

export function selectionRangeFromTimeMarquee(
  segments: SegmentDto[],
  t0: number,
  t1: number,
  durationSec: number,
): { lo: number; hi: number } | null {
  const loT = Math.min(t0, t1);
  const hiT = Math.max(t0, t1);
  const { packableIndices } = selectPackableSegmentIndices(segments, durationSec);
  let lo = -1;
  let hi = -1;
  for (const idx of packableIndices) {
    const seg = segments[idx];
    if (!seg) continue;
    const segLo = Math.min(seg.start_sec, seg.end_sec);
    const segHi = Math.max(seg.start_sec, seg.end_sec);
    if (segHi <= loT || segLo >= hiT) continue;
    if (lo < 0 || idx < lo) lo = idx;
    if (hi < 0 || idx > hi) hi = idx;
  }
  if (lo < 0 || hi < 0) return null;
  return { lo, hi };
}

export function mergeSegmentRangeFold(
  segments: SegmentDto[],
  lo: number,
  hi: number,
): SegmentDto {
  let merged = segments[lo]!;
  for (let i = lo + 1; i <= hi; i += 1) {
    merged = mergeTwoSegments(merged, segments[i]!);
  }
  return merged;
}
