import { WAVEFORM_SEGMENT_MIN_SPAN_SEC, type SegmentDragMode } from "./waveformSegmentBounds";
import type { SegmentOverlapPolicy } from "./segmentTimeRange";

export type OverlayDragMode = SegmentDragMode | "create";

export type OverlayPointerUpIntent =
  | { kind: "select-segment"; segmentIdx: number; pointerTimeSec: number }
  | { kind: "commit-bounds"; segmentIdx: number; startSec: number; endSec: number }
  | { kind: "create-range"; startSec: number; endSec: number; overlapPolicy?: SegmentOverlapPolicy }
  | { kind: "seek-blank"; timeSec: number }
  | { kind: "noop" };

/** pointerup 意图（纯函数，供 overlay 与单测共用）。 */
export function resolveOverlayPointerUpIntent(input: {
  mode: OverlayDragMode;
  moved: boolean;
  segmentIdx: number;
  pointerTimeSec: number;
  anchorTimeSec: number;
  initialStartSec: number;
  initialEndSec: number;
  clampedStartSec: number;
  clampedEndSec: number;
  minSpanSec?: number;
}): OverlayPointerUpIntent {
  const minSpan = input.minSpanSec ?? WAVEFORM_SEGMENT_MIN_SPAN_SEC;

  if (input.mode === "create") {
    const lo = Math.min(input.initialStartSec, input.pointerTimeSec);
    const hi = Math.max(input.initialStartSec, input.pointerTimeSec);
    if (Math.abs(hi - lo) >= minSpan) {
      return { kind: "create-range", startSec: input.clampedStartSec, endSec: input.clampedEndSec };
    }
    return { kind: "seek-blank", timeSec: input.pointerTimeSec };
  }

  if (!input.moved) {
    return {
      kind: "select-segment",
      segmentIdx: input.segmentIdx,
      pointerTimeSec: input.pointerTimeSec,
    };
  }

  const unchanged =
    Math.abs(input.clampedStartSec - input.initialStartSec) < 0.0005 &&
    Math.abs(input.clampedEndSec - input.initialEndSec) < 0.0005;
  if (unchanged) {
    return {
      kind: "select-segment",
      segmentIdx: input.segmentIdx,
      pointerTimeSec: input.pointerTimeSec,
    };
  }

  return {
    kind: "commit-bounds",
    segmentIdx: input.segmentIdx,
    startSec: input.clampedStartSec,
    endSec: input.clampedEndSec,
  };
}
