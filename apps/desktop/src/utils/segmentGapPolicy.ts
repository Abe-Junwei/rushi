import { roundSec3 } from "./boundsSignature";
import { WAVEFORM_SEGMENT_MIN_SPAN_SEC, clampSegmentTimeBounds } from "./waveformSegmentBounds";
import { applySnapToDragBounds, type SnapDragMode } from "./segmentTimeSnap";

/** Epsilon when clamping drag bounds against immediate neighbors (no overlap). */
const SEGMENT_NEIGHBOR_BOUND_EPS_SEC = 1e-6;

/** Minimum clear gap required to insert a segment between two neighbors (toolbar insert-after). */
const SEGMENT_MIN_INSERT_GAP_SEC = 0.12;

/** Default tail span when inserting after the last segment. */
const SEGMENT_INSERT_AFTER_TAIL_SEC = 1;

/** Live drag preview may shrink slightly below commit min span. */
export const SEGMENT_BOUNDS_LIVE_MIN_SPAN_SEC = 0.02;

/** Clamp segment bounds so they do not cross immediate neighbors (drag / resize). */
export function clampSegmentBoundsToNeighbors(
  startSec: number,
  endSec: number,
  neighbors: { prevEndSec?: number; nextStartSec?: number },
): { startSec: number; endSec: number } {
  let lo = Math.min(startSec, endSec);
  let hi = Math.max(startSec, endSec);
  const prevEnd = neighbors.prevEndSec;
  const nextStart = neighbors.nextStartSec;
  if (prevEnd != null && Number.isFinite(prevEnd)) {
    lo = Math.max(lo, prevEnd + SEGMENT_NEIGHBOR_BOUND_EPS_SEC);
  }
  if (nextStart != null && Number.isFinite(nextStart)) {
    hi = Math.min(hi, nextStart - SEGMENT_NEIGHBOR_BOUND_EPS_SEC);
  }
  return { startSec: roundSec3(lo), endSec: roundSec3(hi) };
}

export type InsertAfterSpanResult =
  | { ok: true; startSec: number; endSec: number }
  | { ok: false; reason: "gap-too-small" | "invalid-span" };

/**
 * Resolve time span for「在选中语段后插入」：占相邻空档约 45%（0.08–2s），
 * 末条语段后默认 +1s；空档不足则失败。
 */
export function resolveInsertAfterSpan(input: {
  prevEndSec: number;
  nextStartSec?: number;
  mediaDurationSec?: number;
}): InsertAfterSpanResult {
  const startSec = input.prevEndSec;
  let endSec: number;
  if (input.nextStartSec != null && Number.isFinite(input.nextStartSec)) {
    const gap = input.nextStartSec - input.prevEndSec;
    if (!Number.isFinite(gap) || gap < SEGMENT_MIN_INSERT_GAP_SEC) {
      return { ok: false, reason: "gap-too-small" };
    }
    endSec = input.prevEndSec + Math.min(Math.max(gap * 0.45, 0.08), 2);
  } else {
    endSec = input.prevEndSec + SEGMENT_INSERT_AFTER_TAIL_SEC;
  }
  if (input.mediaDurationSec != null && input.mediaDurationSec > 0) {
    endSec = Math.min(endSec, input.mediaDurationSec);
  }
  endSec = roundSec3(endSec);
  if (endSec <= startSec + 0.04) {
    return { ok: false, reason: "invalid-span" };
  }
  return { ok: true, startSec: roundSec3(startSec), endSec };
}

/** Snap + track clamp + neighbor clamp + min span (overlay drag/create finish). */
export function finalizeSegmentOverlayBounds(input: {
  bounds: { startSec: number; endSec: number };
  mode: SnapDragMode;
  targets: readonly number[];
  thresholdSec: number;
  snapEnabled: boolean;
  durationSec: number;
  neighbors?: { prevEndSec?: number; nextStartSec?: number };
  minSpanSec?: number;
}): { startSec: number; endSec: number } | null {
  let { startSec, endSec } = input.bounds;
  if (input.snapEnabled) {
    ({ startSec, endSec } = applySnapToDragBounds(
      { startSec, endSec },
      input.mode,
      input.targets,
      input.thresholdSec,
      true,
    ));
  }
  ({ startSec, endSec } = clampSegmentTimeBounds(
    startSec,
    endSec,
    input.durationSec > 0 ? input.durationSec : endSec,
  ));
  if (input.neighbors) {
    ({ startSec, endSec } = clampSegmentBoundsToNeighbors(startSec, endSec, input.neighbors));
  }
  const minSpan = input.minSpanSec ?? WAVEFORM_SEGMENT_MIN_SPAN_SEC;
  if (!segmentBoundsMeetMinSpan(startSec, endSec, minSpan)) {
    return null;
  }
  return { startSec, endSec };
}

/** Insert index: first segment whose start is strictly after `startSec`. */
export function findSegmentInsertIndexByStart(
  segments: ReadonlyArray<{ start_sec: number }>,
  startSec: number,
): number {
  const insertAt = segments.findIndex((s) => s.start_sec > startSec);
  return insertAt === -1 ? segments.length : insertAt;
}

/** Whether clamped bounds still meet minimum span after neighbor clamp. */
export function segmentBoundsMeetMinSpan(
  startSec: number,
  endSec: number,
  minSpanSec = WAVEFORM_SEGMENT_MIN_SPAN_SEC,
): boolean {
  return endSec - startSec >= minSpanSec;
}
