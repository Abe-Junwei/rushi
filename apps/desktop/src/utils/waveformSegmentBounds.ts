import type { SegmentDto, SegmentKind } from "../tauri/projectApi";
import { roundSec3 } from "./boundsSignature";
import { timeToTimelinePx } from "./waveformProjection";

export const WAVEFORM_SEGMENT_MIN_SPAN_SEC = 0.05;

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
    prevPaintedEndSec: pos > 0 ? ordered[pos - 1]!.end : null,
    nextPaintedStartSec: pos < ordered.length - 1 ? ordered[pos + 1]!.start : null,
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

/** Packable segment time spans for long-media median default zoom. */
export function collectPackableSegmentSpansSec(
  segments: ReadonlyArray<PlaceholderProbe>,
  durationSec: number,
): number[] {
  const packable = selectPackableSegments(segments, durationSec);
  const spans: number[] = [];
  for (const seg of packable) {
    const span = Math.abs(seg.end_sec - seg.start_sec);
    if (Number.isFinite(span) && span > 0) spans.push(span);
  }
  return spans;
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
  /** When set with durationSec, expand narrow segments to {@link WAVEFORM_SEGMENT_MIN_HIT_WIDTH_PX}. */
  timelineWidthPx?: number;
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

  for (let i = 0; i < segments.length; i += 1) {
    const seg = segments[i];
    if (!seg) continue;
    if (dominantSet?.has(i)) continue;
    const start = Math.min(seg.start_sec, seg.end_sec);
    const end = Math.max(seg.start_sec, seg.end_sec);
    if (!orderedPackable) {
      if (timeSec >= start && timeSec <= end) timeHits.push(i);
      continue;
    }
    const pos = orderedPackable.findIndex((x) => x.i === i);
    if (pos < 0) continue;
    const prev = pos > 0 ? orderedPackable[pos - 1] : null;
    const next = pos < orderedPackable.length - 1 ? orderedPackable[pos + 1] : null;
    const hit = resolveExpandedSegmentHitBoundsSec({
      startSec: start,
      endSec: end,
      durationSec,
      timelineWidthPx,
      prevPaintedEndSec: prev?.end ?? null,
      nextPaintedStartSec: next?.start ?? null,
    });
    if (timeSec >= hit.startSec && timeSec <= hit.endSec) timeHits.push(i);
  }
  if (timeHits.length === 0) return -1;
  if (timeHits.includes(selectedIdx)) return selectedIdx;
  return Math.max(...timeHits);
}
