import { roundSec3 } from "./boundsSignature";
import { WAVEFORM_SEGMENT_MIN_SPAN_SEC } from "./waveformSegmentBounds";

/** Sub-span bleed from pointer mapping / rounding is ignored below this overlap. */
export const SEGMENT_TIME_OVERLAP_EPS_SEC = 0.02;

export function segmentTimeRangesOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
  minOverlapSec = SEGMENT_TIME_OVERLAP_EPS_SEC,
): boolean {
  const loA = Math.min(aStart, aEnd);
  const hiA = Math.max(aStart, aEnd);
  const loB = Math.min(bStart, bEnd);
  const hiB = Math.max(bStart, bEnd);
  const overlap = Math.min(hiA, hiB) - Math.max(loA, loB);
  return overlap > minOverlapSec;
}

/**
 * Trim a create-range so it fits in the gaps between existing segments.
 * Returns null when the range cannot clear neighbors while keeping min span.
 */
export function clampCreateRangeClearOfSegments(
  segments: ReadonlyArray<{ start_sec: number; end_sec: number }>,
  rawLo: number,
  rawHi: number,
  minSpanSec = WAVEFORM_SEGMENT_MIN_SPAN_SEC,
): { startSec: number; endSec: number } | null {
  let lo = Math.min(rawLo, rawHi);
  let hi = Math.max(rawLo, rawHi);
  if (hi - lo < minSpanSec) return null;

  const normalized = segments
    .map((s) => ({
      start: Math.min(s.start_sec, s.end_sec),
      end: Math.max(s.start_sec, s.end_sec),
    }))
    .filter((s) => Number.isFinite(s.start) && Number.isFinite(s.end))
    .sort((a, b) => a.start - b.start);

  for (let pass = 0; pass < normalized.length + 1; pass += 1) {
    let changed = false;
    for (const seg of normalized) {
      if (hi <= seg.start + SEGMENT_TIME_OVERLAP_EPS_SEC || lo >= seg.end - SEGMENT_TIME_OVERLAP_EPS_SEC) {
        continue;
      }
      const overlapLo = Math.max(lo, seg.start);
      const overlapHi = Math.min(hi, seg.end);
      if (overlapHi - overlapLo <= SEGMENT_TIME_OVERLAP_EPS_SEC) {
        continue;
      }
      const trimLeft = seg.end - lo;
      const trimRight = hi - seg.start;
      if (trimLeft <= trimRight) {
        if (lo < seg.end) {
          lo = seg.end;
          changed = true;
        }
      } else if (hi > seg.start) {
        hi = seg.start;
        changed = true;
      }
      if (hi - lo < minSpanSec) return null;
    }
    if (!changed) break;
  }

  for (const seg of normalized) {
    if (segmentTimeRangesOverlap(lo, hi, seg.start, seg.end)) {
      return null;
    }
  }

  return { startSec: roundSec3(lo), endSec: roundSec3(hi) };
}
