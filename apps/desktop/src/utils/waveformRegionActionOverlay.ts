import { timeToTimelinePx } from "./waveformProjection";

/** 语段播放控制条预估宽度（loop + play）。 */
export const WAVEFORM_REGION_ACTION_OVERLAY_EST_WIDTH_PX = 160;

const REGION_ACTION_PLAY_BTN_PX = 24;
const REGION_ACTION_LOOP_BTN_PX = 24;
const REGION_ACTION_BTN_GAP_PX = 3;

const REGION_ACTION_WIDTH_PLAY_ONLY_PX = REGION_ACTION_PLAY_BTN_PX;
const REGION_ACTION_WIDTH_LOOP_PLAY_PX =
  REGION_ACTION_PLAY_BTN_PX + REGION_ACTION_BTN_GAP_PX + REGION_ACTION_LOOP_BTN_PX;

export type SegmentPlaybackControlsOverlayLayout = {
  visible: boolean;
  /** Sticky 视口坐标（与语段 band canvas 一致），非 timeline shell 坐标。 */
  overlayLeftPx: number;
  overlayWidthPx: number;
  showLoopBtn: boolean;
  segmentWidthPx: number;
  visibleSegmentWidthPx: number;
};

/** 按语段（可见部分）宽度决定展示哪些控件，避免窄语段挤叠。 */
export function resolveSegmentPlaybackControlVisibility(fitWidthPx: number): {
  showLoopBtn: boolean;
} {
  if (fitWidthPx >= REGION_ACTION_WIDTH_LOOP_PLAY_PX) {
    return { showLoopBtn: true };
  }
  return { showLoopBtn: false };
}

/** 语段播放控制条位置/可见性。`viewport` = sticky 壳内坐标；`timeline` = 随 tier 横向滚动。 */
export function resolveSegmentPlaybackControlsOverlayLayout(input: {
  segmentStartSec: number;
  segmentEndSec: number;
  timelineWidthPx: number;
  durationSec: number;
  scrollLeftPx: number;
  viewportWidthPx: number;
  coordinateSpace?: "viewport" | "timeline";
}): SegmentPlaybackControlsOverlayLayout {
  const timelineWidthPx = Math.max(1, input.timelineWidthPx);
  const durationSec = Math.max(input.durationSec, 0.001);
  const scrollLeftPx = Math.max(0, input.scrollLeftPx);
  const viewportWidthPx = Math.max(1, input.viewportWidthPx);

  const lo = Math.min(input.segmentStartSec, input.segmentEndSec);
  const hi = Math.max(input.segmentStartSec, input.segmentEndSec);
  const leftPx = timeToTimelinePx(lo, timelineWidthPx, durationSec);
  const rightPx = timeToTimelinePx(hi, timelineWidthPx, durationSec);
  const segmentWidthPx = Math.max(2, rightPx - leftPx);

  const segLeftVp = leftPx - scrollLeftPx;
  const segRightVp = rightPx - scrollLeftPx;
  const visibleLeftVp = Math.max(segLeftVp, 0);
  const visibleRightVp = Math.min(segRightVp, viewportWidthPx);
  const visibleSegmentWidthPx = Math.max(0, visibleRightVp - visibleLeftVp);

  const visible = visibleSegmentWidthPx > 0;
  const fitWidthPx = Math.min(segmentWidthPx, visibleSegmentWidthPx);
  const { showLoopBtn } = resolveSegmentPlaybackControlVisibility(fitWidthPx);
  const overlayWidthPx = estimateRegionActionOverlayWidthPx({ showLoopBtn });

  const coordinateSpace = input.coordinateSpace ?? "viewport";

  if (coordinateSpace === "timeline") {
    const visibleLeftTimelinePx = visibleLeftVp + scrollLeftPx;
    const visibleRightTimelinePx = visibleRightVp + scrollLeftPx;
    const visibleCenterTimelinePx = (visibleLeftTimelinePx + visibleRightTimelinePx) / 2;
    const segMinLeft = visibleLeftTimelinePx;
    const segMaxLeft = Math.max(segMinLeft, visibleRightTimelinePx - overlayWidthPx);
    const overlayLeftPx = Math.max(
      segMinLeft,
      Math.min(segMaxLeft, visibleCenterTimelinePx - overlayWidthPx / 2),
    );
    return {
      visible,
      overlayLeftPx,
      overlayWidthPx,
      showLoopBtn,
      segmentWidthPx,
      visibleSegmentWidthPx,
    };
  }

  const segCenterVp = (leftPx + rightPx) / 2 - scrollLeftPx;
  let overlayLeftPx = segCenterVp - overlayWidthPx / 2;

  if (visible) {
    const segVisMinLeft = visibleLeftVp;
    const segVisMaxLeft = Math.max(segVisMinLeft, visibleRightVp - overlayWidthPx);
    overlayLeftPx = Math.max(segVisMinLeft, Math.min(segVisMaxLeft, overlayLeftPx));
    overlayLeftPx = Math.max(0, Math.min(viewportWidthPx - overlayWidthPx, overlayLeftPx));
  }

  return {
    visible,
    overlayLeftPx,
    overlayWidthPx,
    showLoopBtn,
    segmentWidthPx,
    visibleSegmentWidthPx,
  };
}

/** 按可见控件估算播放控制条宽度。 */
export function estimateRegionActionOverlayWidthPx(input: {
  showLoopBtn: boolean;
}): number {
  let widthPx = REGION_ACTION_WIDTH_PLAY_ONLY_PX;
  if (input.showLoopBtn) widthPx += REGION_ACTION_BTN_GAP_PX + REGION_ACTION_LOOP_BTN_PX;
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

/** Timeline-shell 坐标下的居中 left（legacy）；控件已迁至 sticky 视口坐标。 */
export function computeRegionActionOverlayCenterLeftPx(input: {
  segmentStartPx: number;
  segmentWidthPx: number;
  scrollLeftPx: number;
  viewportWidthPx: number;
  overlayEstimatedWidthPx: number;
}): number {
  const est = input.overlayEstimatedWidthPx;
  const segStart = input.segmentStartPx;
  const segEndPx = segStart + input.segmentWidthPx;
  const segMinLeft = segStart;
  const segMaxLeft = Math.max(segMinLeft, segEndPx - est);

  const viewStart = Math.max(0, input.scrollLeftPx);
  const viewEnd = viewStart + Math.max(1, input.viewportWidthPx);

  const visibleLeftPx = Math.max(segStart, viewStart);
  const visibleRightPx = Math.min(segEndPx, viewEnd);
  const hasVisibleIntersection = visibleRightPx > visibleLeftPx;

  const anchorCenterPx = hasVisibleIntersection
    ? (visibleLeftPx + visibleRightPx) / 2
    : segStart + input.segmentWidthPx / 2;

  let idealLeft = anchorCenterPx - est / 2;
  idealLeft = Math.max(segMinLeft, Math.min(segMaxLeft, idealLeft));

  if (hasVisibleIntersection) {
    const viewMinLeft = viewStart;
    const viewMaxLeft = Math.max(viewMinLeft, viewEnd - est);
    idealLeft = Math.max(viewMinLeft, Math.min(viewMaxLeft, idealLeft));
    idealLeft = Math.max(segMinLeft, Math.min(segMaxLeft, idealLeft));
  }

  return idealLeft;
}
