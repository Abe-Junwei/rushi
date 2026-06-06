import { timeToTimelinePx } from "./waveformProjection";

/** 语段播放控制条预估宽度（speed + loop + play）。 */
export const WAVEFORM_REGION_ACTION_OVERLAY_EST_WIDTH_PX = 220;

export type SegmentPlaybackControlsOverlayLayout = {
  visible: boolean;
  overlayLeftPx: number;
  overlayWidthPx: number;
  showSpeedMenu: boolean;
  showLoopBtn: boolean;
  segmentWidthPx: number;
};

/** 语段播放控制条位置/可见性（随 tier scroll 变化）。 */
export function resolveSegmentPlaybackControlsOverlayLayout(input: {
  segmentStartSec: number;
  segmentEndSec: number;
  timelineWidthPx: number;
  durationSec: number;
  scrollLeftPx: number;
  viewportWidthPx: number;
}): SegmentPlaybackControlsOverlayLayout {
  const lo = Math.min(input.segmentStartSec, input.segmentEndSec);
  const hi = Math.max(input.segmentStartSec, input.segmentEndSec);
  const leftPx = timeToTimelinePx(lo, input.timelineWidthPx, input.durationSec);
  const rightPx = timeToTimelinePx(hi, input.timelineWidthPx, input.durationSec);
  const segmentWidthPx = Math.max(2, rightPx - leftPx);
  const visible =
    leftPx + segmentWidthPx >= input.scrollLeftPx &&
    leftPx <= input.scrollLeftPx + input.viewportWidthPx;
  const showSpeedMenu = segmentWidthPx >= 88;
  const showLoopBtn = segmentWidthPx >= 72;
  const overlayWidthPx = estimateRegionActionOverlayWidthPx({ showSpeedMenu, showLoopBtn });
  const overlayLeftPx = computeRegionActionOverlayCenterLeftPx({
    segmentStartPx: leftPx,
    segmentWidthPx,
    scrollLeftPx: input.scrollLeftPx,
    viewportWidthPx: input.viewportWidthPx,
    overlayEstimatedWidthPx: overlayWidthPx,
  });
  return {
    visible,
    overlayLeftPx,
    overlayWidthPx,
    showSpeedMenu,
    showLoopBtn,
    segmentWidthPx,
  };
}

/** 按可见控件估算播放控制条宽度。 */
export function estimateRegionActionOverlayWidthPx(input: {
  showSpeedMenu: boolean;
  showLoopBtn: boolean;
}): number {
  let widthPx = 24;
  if (input.showLoopBtn) widthPx += 3 + 24;
  if (input.showSpeedMenu) widthPx += 3 + 56;
  return widthPx;
}

/** 将播放控制条 left 钳在可见视口内，避免左右溢出。 */
export function computeRegionActionOverlayLeftPx(input: {
  segmentStartPx: number;
  segmentWidthPx: number;
  scrollLeftPx: number;
  viewportWidthPx: number;
  overlayEstimatedWidthPx?: number;
}): number {
  const est = input.overlayEstimatedWidthPx ?? WAVEFORM_REGION_ACTION_OVERLAY_EST_WIDTH_PX;
  const viewStart = Math.max(0, input.scrollLeftPx);
  const viewEnd = viewStart + Math.max(1, input.viewportWidthPx);
  const segStart = input.segmentStartPx;
  const minLeft = viewStart;
  const maxLeft = Math.max(minLeft, viewEnd - est);
  return Math.max(minLeft, Math.min(maxLeft, segStart));
}

/** 播放控制条在语段内水平居中，并钳在可见视口内。 */
export function computeRegionActionOverlayCenterLeftPx(input: {
  segmentStartPx: number;
  segmentWidthPx: number;
  scrollLeftPx: number;
  viewportWidthPx: number;
  overlayEstimatedWidthPx: number;
}): number {
  const est = input.overlayEstimatedWidthPx;
  const viewStart = Math.max(0, input.scrollLeftPx);
  const viewEnd = viewStart + Math.max(1, input.viewportWidthPx);
  const segCenterPx = input.segmentStartPx + input.segmentWidthPx / 2;
  const minLeft = viewStart;
  const maxLeft = Math.max(minLeft, viewEnd - est);
  const idealLeft = segCenterPx - est / 2;
  return Math.max(minLeft, Math.min(maxLeft, idealLeft));
}
