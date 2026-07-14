import type { SegmentDto } from "../tauri/projectApi";
import { timeToTimelinePx } from "./waveformProjection";
import { resolveExpandedSegmentHitBoundsSec } from "./waveformSegmentHitGeometry";
import {
  clampSegmentTimeBounds,
  selectPackableSegmentIndices,
} from "./waveformSegmentPackable";

export {
  WAVEFORM_SEGMENT_MIN_SPAN_SEC,
  WAVEFORM_SEGMENT_EDGE_HIT_PX,
  WAVEFORM_SEGMENT_MIN_HIT_WIDTH_PX,
  type SegmentDragMode,
  resolveSegmentEdgeHitPx,
  expandSegmentHitGeometry,
  resolveExpandedSegmentHitBoundsSec,
  resolvePackableSegmentPaintedNeighbors,
  hitSegmentEdgeFromLocalPx,
  hitSegmentEdgeFromTimelinePointer,
  computeDragSegmentBounds,
} from "./waveformSegmentHitGeometry";

export {
  WAVEFORM_DOMINANT_SPAN_RATIO,
  type PackableSegmentPartition,
  isPlaceholderSegment,
  selectPackableSegmentIndices,
  selectPackableSegments,
  collectPackableSegmentSpansSec,
  clampSegmentTimeBounds,
} from "./waveformSegmentPackable";

/** 语段 overlay 垂直 inset（贴满 canvas 高度） */
export const WAVEFORM_SEGMENT_INSET_TOP_PX = 0;
export const WAVEFORM_SEGMENT_INSET_BOTTOM_PX = 0;

/** 波形语段条几何：始终铺满波形带全高；时间重叠时靠 DOM/z-order 叠放，不垂直分 lane。 */
export function segmentOverlayGeometry(input: {
  startSec: number;
  endSec: number;
  timelineWidthPx: number;
  durationSec: number;
  /** @deprecated 保留入参兼容；垂直布局不再分 lane。 */
  lane: number;
  /** @deprecated 保留入参兼容；垂直布局不再分 lane。 */
  laneCount: number;
  containerHeightPx: number;
}): { leftPx: number; widthPx: number; topPx: number; heightPx: number } {
  const clamped = clampSegmentTimeBounds(input.startSec, input.endSec, input.durationSec);
  const start = clamped.startSec;
  const end = clamped.endSec;
  const insetTop = WAVEFORM_SEGMENT_INSET_TOP_PX;
  const insetBottom = WAVEFORM_SEGMENT_INSET_BOTTOM_PX;
  const bandHeight = Math.max(20, input.containerHeightPx - insetTop - insetBottom);

  const leftPx = timeToTimelinePx(start, input.timelineWidthPx, input.durationSec);
  const rightPx = timeToTimelinePx(end, input.timelineWidthPx, input.durationSec);

  return {
    leftPx,
    widthPx: Math.max(2, rightPx - leftPx),
    topPx: insetTop,
    heightPx: bandHeight,
  };
}

/** 按时间命中语段；全高条带重叠时优先选中项，否则取较大 index（DOM 后绘制的在上层）。 */
export function resolveSegmentIndexAtWaveformPointer(input: {
  segments: SegmentDto[];
  timeSec: number;
  pointerClientY: number;
  overlayClientTop: number;
  layoutHeightPx: number;
  laneByIndex: number[];
  laneCount: number;
  selectedIdx: number;
  /** When set, whole-track placeholder segments are ignored for hit testing. */
  durationSec?: number;
  /** Visual scaleY on overlay ancestor (1 = no preview shrink). */
  layoutYScale?: number;
  /** When set with durationSec, expand narrow segments to {@link WAVEFORM_SEGMENT_MIN_HIT_WIDTH_PX}. */
  timelineWidthPx?: number;
  /**
   * When filter is active: only these indices are hittable on the blank shell.
   * Selected DOM overlays still receive their own pointer events.
   * null = all segments hittable.
   */
  listVisibleIndexSet?: ReadonlySet<number> | null;
}): number {
  const {
    segments,
    timeSec,
    pointerClientY,
    overlayClientTop,
    layoutHeightPx,
    layoutYScale = 1,
    durationSec = 0,
    selectedIdx,
    timelineWidthPx = 0,
    listVisibleIndexSet: listVisible = null,
  } = input;
  if (segments.length === 0) return -1;

  const scale = layoutYScale > 0 ? layoutYScale : 1;
  const localY = (pointerClientY - overlayClientTop) / scale;
  const insetTop = WAVEFORM_SEGMENT_INSET_TOP_PX;
  const insetBottom = WAVEFORM_SEGMENT_INSET_BOTTOM_PX;
  const bandTop = insetTop;
  const bandBottom = layoutHeightPx - insetBottom;
  if (localY < bandTop || localY > bandBottom) return -1;

  const { dominantSpanIndices, packableIndices } = selectPackableSegmentIndices(
    segments,
    durationSec,
  );
  const dominantSet = dominantSpanIndices.length > 0 ? new Set(dominantSpanIndices) : null;
  const timeHits: number[] = [];
  const canExpand = durationSec > 0 && timelineWidthPx > 0;

  // Packable list sorted by time — iterate once (O(n)), not findIndex per segment (O(n²)).
  const orderedPackable = canExpand
    ? packableIndices
        .map((i) => {
          const seg = segments[i];
          if (!seg) return null;
          return {
            i,
            start: Math.min(seg.start_sec, seg.end_sec),
            end: Math.max(seg.start_sec, seg.end_sec),
          };
        })
        .filter((x): x is { i: number; start: number; end: number } => x != null)
        .sort((a, b) => a.start - b.start || a.end - b.end)
    : null;

  if (orderedPackable) {
    for (let pos = 0; pos < orderedPackable.length; pos += 1) {
      const cur = orderedPackable[pos];
      if (!cur) continue;
      if (listVisible && !listVisible.has(cur.i)) continue;
      if (dominantSet?.has(cur.i)) continue;
      const prev = pos > 0 ? orderedPackable[pos - 1] : null;
      const next = pos < orderedPackable.length - 1 ? orderedPackable[pos + 1] : null;
      const hit = resolveExpandedSegmentHitBoundsSec({
        startSec: cur.start,
        endSec: cur.end,
        durationSec,
        timelineWidthPx,
        prevPaintedEndSec: prev?.end ?? null,
        nextPaintedStartSec: next?.start ?? null,
      });
      if (timeSec >= hit.startSec && timeSec <= hit.endSec) timeHits.push(cur.i);
    }
  } else {
    for (let i = 0; i < segments.length; i += 1) {
      const seg = segments[i];
      if (!seg) continue;
      if (listVisible && !listVisible.has(i)) continue;
      if (dominantSet?.has(i)) continue;
      const start = Math.min(seg.start_sec, seg.end_sec);
      const end = Math.max(seg.start_sec, seg.end_sec);
      if (timeSec >= start && timeSec <= end) timeHits.push(i);
    }
  }
  if (timeHits.length === 0) return -1;
  if (timeHits.includes(selectedIdx)) return selectedIdx;
  return Math.max(...timeHits);
}
