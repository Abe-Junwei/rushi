import type { SegmentDto, SegmentKind } from "../tauri/projectApi";
import { timeToTimelinePx } from "./waveformProjection";
import {
  clampSegmentTimeBounds,
  selectPackableSegmentIndices,
  WAVEFORM_SEGMENT_MIN_SPAN_SEC,
} from "./waveformSegmentPackable";

export { WAVEFORM_SEGMENT_MIN_SPAN_SEC };

export type SegmentDragMode = "move" | "resize-start" | "resize-end";

/** Painted edge handle size when the segment is wide enough for both edges + a move zone. */
export const WAVEFORM_SEGMENT_EDGE_HIT_PX = 8;

/** Minimum hit-test width for extremely narrow painted segments (time truth unchanged). */
export const WAVEFORM_SEGMENT_MIN_HIT_WIDTH_PX = 24;

/** Edge hit size that still leaves a move zone when the painted width is narrow. */
export function resolveSegmentEdgeHitPx(widthPx: number): number {
  const w = Math.max(0, widthPx);
  if (w >= WAVEFORM_SEGMENT_EDGE_HIT_PX * 2) {
    return WAVEFORM_SEGMENT_EDGE_HIT_PX;
  }
  return Math.max(1, Math.floor(w / 3));
}

/** Expand painted geometry to a minimum hit width, centered and clamped to the timeline. */
export function expandSegmentHitGeometry(input: {
  leftPx: number;
  widthPx: number;
  timelineWidthPx: number;
  /** Painted right edge of previous packable segment (px); gap midpoint caps expansion. */
  prevPaintedRightPx?: number | null;
  /** Painted left edge of next packable segment (px). */
  nextPaintedLeftPx?: number | null;
}): { leftPx: number; widthPx: number } {
  const painted = Math.max(2, input.widthPx);
  const tw = Math.max(painted, input.timelineWidthPx);
  const paintedLeft = input.leftPx;
  const paintedRight = input.leftPx + painted;
  if (painted >= WAVEFORM_SEGMENT_MIN_HIT_WIDTH_PX) {
    return { leftPx: paintedLeft, widthPx: painted };
  }
  const target = Math.min(WAVEFORM_SEGMENT_MIN_HIT_WIDTH_PX, tw);
  const center = paintedLeft + painted / 2;
  let left = center - target / 2;
  let right = center + target / 2;
  if (left < 0) {
    right -= left;
    left = 0;
  }
  if (right > tw) {
    left -= right - tw;
    right = tw;
  }
  left = Math.max(0, left);
  right = Math.max(left + painted, right);

  if (input.prevPaintedRightPx != null && Number.isFinite(input.prevPaintedRightPx)) {
    const mid = (input.prevPaintedRightPx + paintedLeft) / 2;
    left = Math.max(left, mid);
  }
  if (input.nextPaintedLeftPx != null && Number.isFinite(input.nextPaintedLeftPx)) {
    const mid = (paintedRight + input.nextPaintedLeftPx) / 2;
    right = Math.min(right, mid);
  }
  // Painted span must remain hittable.
  left = Math.min(left, paintedLeft);
  right = Math.max(right, paintedRight);
  return { leftPx: left, widthPx: Math.max(painted, right - left) };
}

/**
 * Time-domain hit bounds with min width + neighbor half-shrink (same rules as
 * {@link expandSegmentHitGeometry}).
 */
export function resolveExpandedSegmentHitBoundsSec(input: {
  startSec: number;
  endSec: number;
  durationSec: number;
  timelineWidthPx: number;
  prevPaintedEndSec?: number | null;
  nextPaintedStartSec?: number | null;
}): { startSec: number; endSec: number } {
  const start = Math.min(input.startSec, input.endSec);
  const end = Math.max(input.startSec, input.endSec);
  const dur = Math.max(input.durationSec, WAVEFORM_SEGMENT_MIN_SPAN_SEC);
  const tw = Math.max(1, input.timelineWidthPx);
  const leftPx = timeToTimelinePx(start, tw, dur);
  const rightPx = timeToTimelinePx(end, tw, dur);
  const prevRightPx =
    input.prevPaintedEndSec != null
      ? timeToTimelinePx(input.prevPaintedEndSec, tw, dur)
      : null;
  const nextLeftPx =
    input.nextPaintedStartSec != null
      ? timeToTimelinePx(input.nextPaintedStartSec, tw, dur)
      : null;
  const hit = expandSegmentHitGeometry({
    leftPx,
    widthPx: Math.max(2, rightPx - leftPx),
    timelineWidthPx: tw,
    prevPaintedRightPx: prevRightPx,
    nextPaintedLeftPx: nextLeftPx,
  });
  const hitStart = (hit.leftPx / tw) * dur;
  const hitEnd = ((hit.leftPx + hit.widthPx) / tw) * dur;
  return {
    startSec: Math.max(0, Math.min(start, hitStart)),
    endSec: Math.min(dur, Math.max(end, hitEnd)),
  };
}

type PlaceholderProbe = Pick<SegmentDto, "start_sec" | "end_sec"> & {
  kind?: SegmentKind | null;
};

/** Prev/next painted time edges among packable segments (sorted by start). */
export function resolvePackableSegmentPaintedNeighbors(
  segments: ReadonlyArray<PlaceholderProbe>,
  segmentIndex: number,
  durationSec: number,
): { prevPaintedEndSec: number | null; nextPaintedStartSec: number | null } {
  const { packableIndices } = selectPackableSegmentIndices(segments, durationSec);
  const ordered = packableIndices
    .map((i) => {
      const seg = segments[i];
      if (!seg) return null;
      const start = Math.min(seg.start_sec, seg.end_sec);
      const end = Math.max(seg.start_sec, seg.end_sec);
      return { i, start, end };
    })
    .filter((x): x is { i: number; start: number; end: number } => x != null)
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const pos = ordered.findIndex((x) => x.i === segmentIndex);
  if (pos < 0) {
    return { prevPaintedEndSec: null, nextPaintedStartSec: null };
  }
  return {
    prevPaintedEndSec: pos > 0 ? ordered[pos - 1].end : null,
    nextPaintedStartSec: pos < ordered.length - 1 ? ordered[pos + 1].start : null,
  };
}

/** 由语段条内局部 X 与宽度判定 resize / move（不读 DOM）。 */
export function hitSegmentEdgeFromLocalPx(localPx: number, widthPx: number): SegmentDragMode {
  const edge = resolveSegmentEdgeHitPx(widthPx);
  if (localPx <= edge) return "resize-start";
  if (localPx >= widthPx - edge) return "resize-end";
  return "move";
}

/** 由指针时间与语段时间边界判定 resize / move。 */
export function hitSegmentEdgeFromTimelinePointer(input: {
  pointerTimeSec: number;
  startSec: number;
  endSec: number;
  timelineWidthPx: number;
  durationSec: number;
  prevPaintedEndSec?: number | null;
  nextPaintedStartSec?: number | null;
}): SegmentDragMode {
  const start = Math.min(input.startSec, input.endSec);
  const end = Math.max(input.startSec, input.endSec);
  const leftPx = timeToTimelinePx(start, input.timelineWidthPx, input.durationSec);
  const rightPx = timeToTimelinePx(end, input.timelineWidthPx, input.durationSec);
  const paintedWidthPx = Math.max(2, rightPx - leftPx);
  const prevRightPx =
    input.prevPaintedEndSec != null
      ? timeToTimelinePx(input.prevPaintedEndSec, input.timelineWidthPx, input.durationSec)
      : null;
  const nextLeftPx =
    input.nextPaintedStartSec != null
      ? timeToTimelinePx(input.nextPaintedStartSec, input.timelineWidthPx, input.durationSec)
      : null;
  const hit = expandSegmentHitGeometry({
    leftPx,
    widthPx: paintedWidthPx,
    timelineWidthPx: input.timelineWidthPx,
    prevPaintedRightPx: prevRightPx,
    nextPaintedLeftPx: nextLeftPx,
  });
  const pointerPx = timeToTimelinePx(
    input.pointerTimeSec,
    input.timelineWidthPx,
    input.durationSec,
  );
  return hitSegmentEdgeFromLocalPx(pointerPx - hit.leftPx, hit.widthPx);
}

/** 由拖拽模式与指针位移计算语段时间边界（供 overlay move / finish 共用）。 */
export function computeDragSegmentBounds(
  mode: SegmentDragMode,
  initialStartSec: number,
  initialEndSec: number,
  deltaSec: number,
  durationSec: number,
): { startSec: number; endSec: number } {
  let startSec = initialStartSec;
  let endSec = initialEndSec;
  if (mode === "move") {
    const span = Math.max(endSec - startSec, WAVEFORM_SEGMENT_MIN_SPAN_SEC);
    startSec = initialStartSec + deltaSec;
    endSec = startSec + span;
  } else if (mode === "resize-start") {
    startSec = initialStartSec + deltaSec;
  } else {
    endSec = initialEndSec + deltaSec;
  }
  return clampSegmentTimeBounds(startSec, endSec, durationSec || endSec);
}
