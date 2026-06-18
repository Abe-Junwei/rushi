import type { SegmentDto } from "../../tauri/projectApi";
import { paddedVisibleTimeWindow, timeToTimelinePx } from "../../utils/waveformProjection";
import {
  WAVEFORM_SEGMENT_INSET_BOTTOM_PX,
  WAVEFORM_SEGMENT_INSET_TOP_PX,
} from "../../utils/waveformSegmentBounds";
import {
  readWaveformSegmentBandPalette,
  segmentBandFillStyle,
} from "../../utils/waveformSegmentBandCanvasColors";
import { resolveWaveformSegmentFillState } from "../../utils/segmentChrome";

const SEGMENT_BAND_VIEWPORT_PAD_MUL = 1.5;
const SEGMENT_BAND_INDEX_SCAN_THRESHOLD = 200;

/** First index whose end >= windowStart (segments sorted by start_sec). */
export function findFirstSegmentIndexEndingAtOrAfter(
  segments: readonly { start_sec: number; end_sec: number }[],
  windowStartSec: number,
): number {
  let lo = 0;
  let hi = segments.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const seg = segments[mid];
    const end = Math.max(seg.start_sec, seg.end_sec);
    if (end < windowStartSec) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Last index whose start <= windowEnd (segments sorted by start_sec). */
export function findLastSegmentIndexStartingAtOrBefore(
  segments: readonly { start_sec: number; end_sec: number }[],
  windowEndSec: number,
): number {
  let lo = 0;
  let hi = segments.length - 1;
  let last = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const seg = segments[mid];
    const start = Math.min(seg.start_sec, seg.end_sec);
    if (start <= windowEndSec) {
      last = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return last;
}

export function drawWaveformSegmentBands(input: {
  ctx: CanvasRenderingContext2D;
  segments: SegmentDto[];
  dominantSpanIndices?: readonly number[];
  scrollLeftPx: number;
  viewportWidthPx: number;
  timelineWidthPx: number;
  durationSec: number;
  layoutHeightPx: number;
  selectedIdx?: number;
  selectedIndices?: ReadonlySet<number>;
  selectionLo?: number;
  selectionHi?: number;
  selectionCount?: number;
  playheadSec?: number;
  skipIndices?: readonly number[];
}): void {
  const {
    ctx,
    segments,
    scrollLeftPx,
    viewportWidthPx,
    timelineWidthPx,
    durationSec,
    layoutHeightPx,
    selectedIdx = -1,
    selectedIndices,
    selectionLo,
    selectionHi,
    selectionCount,
    playheadSec,
  } = input;
  const widthPx = Math.max(1, Math.floor(viewportWidthPx));
  const heightPx = Math.max(1, Math.floor(layoutHeightPx));
  ctx.clearRect(0, 0, widthPx, heightPx);

  if (segments.length === 0 || durationSec <= 0 || timelineWidthPx <= 0) return;

  const timeWindow = paddedVisibleTimeWindow(
    {
      scrollLeftPx,
      viewportWidthPx,
      timelineWidthPx,
      durationSec,
    },
    SEGMENT_BAND_VIEWPORT_PAD_MUL,
  );

  const insetTop = WAVEFORM_SEGMENT_INSET_TOP_PX;
  const bandHeight = Math.max(20, heightPx - insetTop - WAVEFORM_SEGMENT_INSET_BOTTOM_PX);
  const palette = readWaveformSegmentBandPalette();
  const dominant = new Set(input.dominantSpanIndices ?? []);
  const skip = new Set(input.skipIndices ?? []);

  const useIndexWindow = segments.length >= SEGMENT_BAND_INDEX_SCAN_THRESHOLD;
  const indexFrom = useIndexWindow
    ? findFirstSegmentIndexEndingAtOrAfter(segments, timeWindow.start)
    : 0;
  const indexTo = useIndexWindow
    ? findLastSegmentIndexStartingAtOrBefore(segments, timeWindow.end)
    : segments.length - 1;

  if (indexTo < indexFrom) return;

  for (let idx = indexFrom; idx <= indexTo; idx += 1) {
    if (dominant.has(idx)) continue;
    if (skip.has(idx)) continue;
    const seg = segments[idx];
    if (!seg) continue;
    const lo = Math.min(seg.start_sec, seg.end_sec);
    const hi = Math.max(seg.start_sec, seg.end_sec);
    if (hi < timeWindow.start || lo > timeWindow.end) continue;

    const leftTimelinePx = timeToTimelinePx(lo, timelineWidthPx, durationSec);
    const rightTimelinePx = timeToTimelinePx(hi, timelineWidthPx, durationSec);
    const bandWidthPx = Math.max(2, rightTimelinePx - leftTimelinePx);
    const leftViewportPx = leftTimelinePx - scrollLeftPx;
    if (leftViewportPx + bandWidthPx < 0 || leftViewportPx > widthPx) continue;

    const { selected, inSelection, multiSelectActive } = resolveWaveformSegmentFillState({
      idx,
      selectedIdx,
      selectedIndices,
      selectionLo,
      selectionHi,
      selectionCount,
    });
    ctx.fillStyle = segmentBandFillStyle(seg, selected, playheadSec, palette, {
      inSelection,
      multiSelectActive,
    });
    ctx.fillRect(leftViewportPx, insetTop, bandWidthPx, bandHeight);

    // 不在 overlay 选中层相邻处画分隔线，避免选中语段开头/结尾出现黑色竖线
    if (skip.has(idx + 1) || skip.has(idx - 1)) continue;

    ctx.strokeStyle = palette.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(leftViewportPx + bandWidthPx - 0.5, insetTop);
    ctx.lineTo(leftViewportPx + bandWidthPx - 0.5, insetTop + bandHeight);
    ctx.stroke();
  }
}
