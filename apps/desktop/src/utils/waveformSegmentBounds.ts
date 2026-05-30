import type { SegmentDto } from "../tauri/projectApi";
import { roundSec3 } from "./boundsSignature";
import { timeToTimelinePx } from "./waveformProjection";

export const WAVEFORM_SEGMENT_MIN_SPAN_SEC = 0.05;

export type SegmentDragMode = "move" | "resize-start" | "resize-end";

export const WAVEFORM_SEGMENT_EDGE_HIT_PX = 8;

/** 由语段条内局部 X 与宽度判定 resize / move（不读 DOM）。 */
export function hitSegmentEdgeFromLocalPx(localPx: number, widthPx: number): SegmentDragMode {
  if (localPx <= WAVEFORM_SEGMENT_EDGE_HIT_PX) return "resize-start";
  if (localPx >= widthPx - WAVEFORM_SEGMENT_EDGE_HIT_PX) return "resize-end";
  return "move";
}

/** 由指针时间与语段时间边界判定 resize / move。 */
export function hitSegmentEdgeFromTimelinePointer(input: {
  pointerTimeSec: number;
  startSec: number;
  endSec: number;
  timelineWidthPx: number;
  durationSec: number;
}): SegmentDragMode {
  const start = Math.min(input.startSec, input.endSec);
  const end = Math.max(input.startSec, input.endSec);
  const leftPx = timeToTimelinePx(start, input.timelineWidthPx, input.durationSec);
  const rightPx = timeToTimelinePx(end, input.timelineWidthPx, input.durationSec);
  const widthPx = Math.max(2, rightPx - leftPx);
  const pointerPx = timeToTimelinePx(
    input.pointerTimeSec,
    input.timelineWidthPx,
    input.durationSec,
  );
  return hitSegmentEdgeFromLocalPx(pointerPx - leftPx, widthPx);
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

/** 语段 overlay 与底部刻度尺留白（与 `WaveformLiveTimeRuler` embedded 区对齐） */
export const WAVEFORM_SEGMENT_INSET_TOP_PX = 4;
export const WAVEFORM_SEGMENT_INSET_BOTTOM_PX = 32;
export const WAVEFORM_SEGMENT_LANE_GAP_PX = 2;

export function clampSegmentTimeBounds(
  startSec: number,
  endSec: number,
  durationSec: number,
): { startSec: number; endSec: number } {
  const lo = Math.min(startSec, endSec);
  const hi = Math.max(startSec, endSec);
  const dur = Math.max(durationSec, WAVEFORM_SEGMENT_MIN_SPAN_SEC);
  const clampedStart = roundSec3(Math.max(0, lo));
  const clampedEnd = roundSec3(Math.min(Math.max(clampedStart + WAVEFORM_SEGMENT_MIN_SPAN_SEC, hi), dur));
  return { startSec: clampedStart, endSec: clampedEnd };
}

/** 波形语段条几何：铺满波形带高度；重叠语段再分 lane（勿用语段列表行高）。 */
export function segmentOverlayGeometry(input: {
  startSec: number;
  endSec: number;
  timelineWidthPx: number;
  durationSec: number;
  lane: number;
  laneCount: number;
  containerHeightPx: number;
}): { leftPx: number; widthPx: number; topPx: number; heightPx: number } {
  const start = Math.min(input.startSec, input.endSec);
  const end = Math.max(input.startSec, input.endSec);
  const lanes = Math.max(1, input.laneCount);
  const insetTop = WAVEFORM_SEGMENT_INSET_TOP_PX;
  const insetBottom = WAVEFORM_SEGMENT_INSET_BOTTOM_PX;
  const bandHeight = Math.max(20, input.containerHeightPx - insetTop - insetBottom);
  const laneGap = WAVEFORM_SEGMENT_LANE_GAP_PX;
  const laneHeight =
    lanes <= 1 ? bandHeight : Math.max(14, Math.floor((bandHeight - laneGap * (lanes - 1)) / lanes));

  const leftPx = timeToTimelinePx(start, input.timelineWidthPx, input.durationSec);
  const rightPx = timeToTimelinePx(end, input.timelineWidthPx, input.durationSec);

  return {
    leftPx,
    widthPx: Math.max(2, rightPx - leftPx),
    topPx: insetTop + input.lane * (laneHeight + laneGap),
    heightPx: laneHeight,
  };
}

/** 按时间与 Y 命中语段；重叠时优先更高 lane，再优先更后渲染的 index。 */
export function resolveSegmentIndexAtWaveformPointer(input: {
  segments: SegmentDto[];
  timeSec: number;
  pointerClientY: number;
  overlayClientTop: number;
  layoutHeightPx: number;
  laneByIndex: number[];
  laneCount: number;
  selectedIdx: number;
  /** Visual scaleY on overlay ancestor (1 = no preview shrink). */
  layoutYScale?: number;
}): number {
  const {
    segments,
    timeSec,
    pointerClientY,
    overlayClientTop,
    layoutHeightPx,
    laneByIndex,
    laneCount,
    layoutYScale = 1,
  } = input;
  if (segments.length === 0) return -1;

  const scale = layoutYScale > 0 ? layoutYScale : 1;
  const localY = (pointerClientY - overlayClientTop) / scale;
  const timeHits: number[] = [];
  for (let i = 0; i < segments.length; i += 1) {
    const seg = segments[i];
    if (!seg) continue;
    const start = Math.min(seg.start_sec, seg.end_sec);
    const end = Math.max(seg.start_sec, seg.end_sec);
    if (timeSec >= start && timeSec <= end) timeHits.push(i);
  }
  if (timeHits.length === 0) {
    return -1;
  }

  const yHits = timeHits.filter((idx) => {
    const seg = segments[idx];
    if (!seg) return false;
    const geom = segmentOverlayGeometry({
      startSec: seg.start_sec,
      endSec: seg.end_sec,
      timelineWidthPx: 1,
      durationSec: 1,
      lane: laneByIndex[idx] ?? 0,
      laneCount,
      containerHeightPx: layoutHeightPx,
    });
    return localY >= geom.topPx && localY <= geom.topPx + geom.heightPx;
  });

  const candidates = yHits.length > 0 ? yHits : timeHits;
  let bestIdx = candidates[0] ?? 0;
  let bestLane = laneByIndex[bestIdx] ?? 0;
  for (let i = 1; i < candidates.length; i += 1) {
    const idx = candidates[i];
    const lane = laneByIndex[idx] ?? 0;
    if (lane > bestLane || (lane === bestLane && idx > bestIdx)) {
      bestIdx = idx;
      bestLane = lane;
    }
  }
  return bestIdx;
}
