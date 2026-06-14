import type { SegmentDto } from "../../tauri/projectApi";
import { paddedVisibleTimeWindow, timeToTimelinePx } from "../../utils/waveformProjection";
import {
  WAVEFORM_SEGMENT_INSET_BOTTOM_PX,
  WAVEFORM_SEGMENT_INSET_TOP_PX,
} from "../../utils/waveformSegmentBounds";
import {
  SEGMENT_BAND_BORDER_COLOR,
  segmentBandFillStyle,
} from "../../utils/waveformSegmentBandCanvasColors";
import { selectOverlayRenderedSegmentIndices } from "../../utils/waveformSegmentOverlayVisibility";

const SEGMENT_BAND_VIEWPORT_PAD_MUL = 1.5;

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
  } = input;
  const widthPx = Math.max(1, Math.floor(viewportWidthPx));
  const heightPx = Math.max(1, Math.floor(layoutHeightPx));
  ctx.clearRect(0, 0, widthPx, heightPx);

  if (segments.length === 0 || durationSec <= 0 || timelineWidthPx <= 0) return;

  const packable = selectOverlayRenderedSegmentIndices({
    segments,
    dominantSpanIndices: input.dominantSpanIndices,
  });
  const skip = new Set(input.skipIndices ?? []);
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

  for (const idx of packable) {
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

    const selected = idx === selectedIdx;
    ctx.fillStyle = segmentBandFillStyle(seg, selected);
    ctx.fillRect(leftViewportPx, insetTop, bandWidthPx, bandHeight);

    // 不在 overlay 选中层相邻处画分隔线，避免选中语段开头/结尾出现黑色竖线
    if (skip.has(idx + 1) || skip.has(idx - 1)) continue;

    ctx.strokeStyle = SEGMENT_BAND_BORDER_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(leftViewportPx + bandWidthPx - 0.5, insetTop);
    ctx.lineTo(leftViewportPx + bandWidthPx - 0.5, insetTop + bandHeight);
    ctx.stroke();
  }
}
