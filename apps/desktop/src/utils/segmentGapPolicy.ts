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

export type SegmentBoundsNeighborPatch = {
  idx: number;
  startSec: number;
  endSec: number;
};

/** Result of resize-eat (or move clamp) against neighbors. */
export type ResizeEatResult = {
  active: { startSec: number; endSec: number };
  neighborPatches: SegmentBoundsNeighborPatch[];
  /** Original indices to delete; apply high→low when mutating. */
  deleteIndices: number[];
};

type SegmentTimeSpan = { start_sec: number; end_sec: number };

/**
 * Resize past a neighbor edge pushes that neighbor; if the neighbor would fall
 * below `minSpanSec`, delete it and keep eating further neighbors (same gesture).
 * `move` only hard-clamps to immediate neighbors (no eat / delete).
 */
export function resolveResizeEatAgainstNeighbors(input: {
  mode: SnapDragMode;
  activeIdx: number;
  rawStartSec: number;
  rawEndSec: number;
  segments: ReadonlyArray<SegmentTimeSpan>;
  minSpanSec?: number;
  durationSec: number;
}): ResizeEatResult | null {
  const minSpan = input.minSpanSec ?? WAVEFORM_SEGMENT_MIN_SPAN_SEC;
  if (!input.segments[input.activeIdx]) return null;

  let { startSec: lo, endSec: hi } = clampSegmentTimeBounds(
    input.rawStartSec,
    input.rawEndSec,
    input.durationSec > 0 ? input.durationSec : Math.max(input.rawStartSec, input.rawEndSec),
  );

  if (input.mode === "move") {
    const prev = input.segments[input.activeIdx - 1];
    const next = input.segments[input.activeIdx + 1];
    ({ startSec: lo, endSec: hi } = clampSegmentBoundsToNeighbors(lo, hi, {
      prevEndSec: prev?.end_sec,
      nextStartSec: next?.start_sec,
    }));
    if (!segmentBoundsMeetMinSpan(lo, hi, minSpan)) return null;
    return {
      active: { startSec: lo, endSec: hi },
      neighborPatches: [],
      deleteIndices: [],
    };
  }

  const neighborPatches: SegmentBoundsNeighborPatch[] = [];
  const deleteIndices: number[] = [];

  if (input.mode === "resize-end") {
    let cursor = input.activeIdx + 1;
    while (cursor < input.segments.length) {
      const n = input.segments[cursor];
      if (!n) break;
      const nStart = Math.min(n.start_sec, n.end_sec);
      const nEnd = Math.max(n.start_sec, n.end_sec);
      if (hi <= nStart + SEGMENT_NEIGHBOR_BOUND_EPS_SEC) break;
      const pushedStart = hi;
      if (nEnd - pushedStart >= minSpan) {
        neighborPatches.push({
          idx: cursor,
          startSec: roundSec3(pushedStart),
          endSec: roundSec3(nEnd),
        });
        break;
      }
      deleteIndices.push(cursor);
      cursor += 1;
    }
  } else if (input.mode === "resize-start") {
    let cursor = input.activeIdx - 1;
    while (cursor >= 0) {
      const n = input.segments[cursor];
      if (!n) break;
      const nStart = Math.min(n.start_sec, n.end_sec);
      const nEnd = Math.max(n.start_sec, n.end_sec);
      if (lo >= nEnd - SEGMENT_NEIGHBOR_BOUND_EPS_SEC) break;
      const pushedEnd = lo;
      if (pushedEnd - nStart >= minSpan) {
        neighborPatches.push({
          idx: cursor,
          startSec: roundSec3(nStart),
          endSec: roundSec3(pushedEnd),
        });
        break;
      }
      deleteIndices.push(cursor);
      cursor -= 1;
    }
  }

  lo = roundSec3(lo);
  hi = roundSec3(hi);
  if (!segmentBoundsMeetMinSpan(lo, hi, minSpan)) return null;
  return {
    active: { startSec: lo, endSec: hi },
    neighborPatches,
    deleteIndices,
  };
}

/**
 * Snap + track clamp, then resize-eat (or move clamp). Prefer this over
 * `finalizeSegmentOverlayBounds` for waveform segment edge drag.
 */
export function finalizeSegmentOverlayBoundsEat(input: {
  bounds: { startSec: number; endSec: number };
  mode: SnapDragMode;
  activeIdx: number;
  segments: ReadonlyArray<SegmentTimeSpan>;
  targets: readonly number[];
  thresholdSec: number;
  snapEnabled: boolean;
  durationSec: number;
  minSpanSec?: number;
}): ResizeEatResult | null {
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
  return resolveResizeEatAgainstNeighbors({
    mode: input.mode,
    activeIdx: input.activeIdx,
    rawStartSec: startSec,
    rawEndSec: endSec,
    segments: input.segments,
    minSpanSec: input.minSpanSec,
    durationSec: input.durationSec,
  });
}
