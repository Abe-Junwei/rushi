import type { SegmentDto, SegmentKind } from "../tauri/projectApi";
import { roundSec3 } from "./boundsSignature";
import { timeToTimelinePx } from "./waveformProjection";

export const WAVEFORM_SEGMENT_MIN_SPAN_SEC = 0.05;

export type SegmentDragMode = "move" | "resize-start" | "resize-end";

const WAVEFORM_SEGMENT_EDGE_HIT_PX = 8;

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

/** 语段 overlay 垂直 inset（贴满 canvas 高度） */
export const WAVEFORM_SEGMENT_INSET_TOP_PX = 0;
export const WAVEFORM_SEGMENT_INSET_BOTTOM_PX = 0;

/** Span ratio above which a segment is treated as whole-track placeholder for waveform UI. */
export const WAVEFORM_DOMINANT_SPAN_RATIO = 0.85;

function isDominantWaveformSpanSegment(
  startSec: number,
  endSec: number,
  durationSec: number,
): boolean {
  if (!(durationSec > 0)) return false;
  const lo = Math.min(startSec, endSec);
  const hi = Math.max(startSec, endSec);
  const span = hi - lo;
  if (span <= 0) return false;
  return span / durationSec >= WAVEFORM_DOMINANT_SPAN_RATIO;
}

type PlaceholderProbe = Pick<SegmentDto, "start_sec" | "end_sec"> & {
  kind?: SegmentKind | null;
};

/**
 * 是否为整轨占位语段（波形上不渲染）。**显式 `kind` 优先**：`placeholder` 即占位、
 * `speech` 即非占位（即便跨度很大也不隐藏，消除短片段长单段的假阳性）；缺省时回退
 * 0.85 跨度启发式（兼容旧数据 / 未标记语段）。
 */
export function isPlaceholderSegment(seg: PlaceholderProbe, durationSec: number): boolean {
  const kind = seg.kind === "placeholder" || seg.kind === "speech" ? seg.kind : undefined;
  if (kind === "placeholder") return true;
  if (kind === "speech") return false;
  return isDominantWaveformSpanSegment(seg.start_sec, seg.end_sec, durationSec);
}

export type PackableSegmentPartition = {
  /** Source indices kept for waveform UI (render / lane packing / hit-test / create-overlap). */
  packableIndices: number[];
  /** Source indices treated as whole-track placeholders, hidden from the waveform UI. */
  dominantSpanIndices: number[];
};

/**
 * Single authority for "which segments participate in the waveform UI" (TRUTH).
 *
 * Whole-track placeholder spans (e.g. the pre-segmentation ASR span) are excluded so
 * that rendering, lane packing, pointer hit-test and create-range overlap all agree on
 * the exact same working set. Routing every consumer through this selector prevents the
 * class of bug where the overlay hides a placeholder yet editing logic still counts it.
 *
 * Pass durationSec <= 0 (unknown duration) to keep every segment packable.
 */
export function selectPackableSegmentIndices(
  segments: ReadonlyArray<PlaceholderProbe>,
  durationSec: number,
): PackableSegmentPartition {
  const packableIndices: number[] = [];
  const dominantSpanIndices: number[] = [];
  for (let i = 0; i < segments.length; i += 1) {
    const seg = segments[i];
    if (!seg) continue;
    if (isPlaceholderSegment(seg, durationSec)) {
      dominantSpanIndices.push(i);
    } else {
      packableIndices.push(i);
    }
  }
  return { packableIndices, dominantSpanIndices };
}

/** Packable segments (identity-preserving) derived from {@link selectPackableSegmentIndices}. */
export function selectPackableSegments<T extends PlaceholderProbe>(
  segments: ReadonlyArray<T>,
  durationSec: number,
): T[] {
  const { packableIndices } = selectPackableSegmentIndices(segments, durationSec);
  return packableIndices.map((i) => segments[i]);
}

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
  } = input;
  if (segments.length === 0) return -1;

  const scale = layoutYScale > 0 ? layoutYScale : 1;
  const localY = (pointerClientY - overlayClientTop) / scale;
  const insetTop = WAVEFORM_SEGMENT_INSET_TOP_PX;
  const insetBottom = WAVEFORM_SEGMENT_INSET_BOTTOM_PX;
  const bandTop = insetTop;
  const bandBottom = layoutHeightPx - insetBottom;
  if (localY < bandTop || localY > bandBottom) return -1;

  const { dominantSpanIndices } = selectPackableSegmentIndices(segments, durationSec);
  const dominantSet = dominantSpanIndices.length > 0 ? new Set(dominantSpanIndices) : null;
  const timeHits: number[] = [];
  for (let i = 0; i < segments.length; i += 1) {
    const seg = segments[i];
    if (!seg) continue;
    if (dominantSet?.has(i)) continue;
    const start = Math.min(seg.start_sec, seg.end_sec);
    const end = Math.max(seg.start_sec, seg.end_sec);
    if (timeSec >= start && timeSec <= end) timeHits.push(i);
  }
  if (timeHits.length === 0) return -1;
  if (timeHits.includes(selectedIdx)) return selectedIdx;
  return Math.max(...timeHits);
}
