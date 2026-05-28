/** 语段播放控制条预估宽度（speed + loop + play）。 */
export const WAVEFORM_REGION_ACTION_OVERLAY_EST_WIDTH_PX = 220;

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
