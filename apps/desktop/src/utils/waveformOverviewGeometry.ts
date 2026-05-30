/** 将主视图 scroll 映射到 overview 条上的视口矩形（像素）。 */
export function computeOverviewViewportRect(input: {
  scrollLeftPx: number;
  viewportWidthPx: number;
  timelineWidthPx: number;
  overviewWidthPx: number;
}): { leftPx: number; widthPx: number } {
  const tw = Math.max(1, input.timelineWidthPx);
  const ow = Math.max(1, input.overviewWidthPx);
  const leftPx = (Math.max(0, input.scrollLeftPx) / tw) * ow;
  const widthPx = (Math.max(0, input.viewportWidthPx) / tw) * ow;
  return {
    leftPx,
    widthPx: Math.max(12, Math.min(ow - leftPx, widthPx)),
  };
}

/** overview 条内整段音频一屏显示的 px/s（无 timeline 最小宽度地板）。 */
export function computeOverviewPxPerSec(overviewWidthPx: number, durationSec: number): number {
  const sec = Math.max(durationSec, 0.5);
  const raw = Math.max(1, overviewWidthPx) / sec;
  return Math.max(0.01, Math.round(raw * 100) / 100);
}

import {
  scrollPxAlignTimeToViewportLeft,
  scrollPxCenterTimeInViewport,
} from "./waveformProjection";

/** 使 `timeSec` 位于主视图视口水平中央时的 tier scrollLeft。 */
export function computeCenterScrollPxForTimeSec(input: {
  timeSec: number;
  timelineWidthPx: number;
  viewportWidthPx: number;
  durationSec: number;
  /** @deprecated 保留兼容；实际使用 timelineWidthPx / durationSec 投影 */
  pxPerSec?: number;
}): number {
  return scrollPxCenterTimeInViewport({
    timeSec: input.timeSec,
    timelineWidthPx: input.timelineWidthPx,
    durationSec: input.durationSec,
    viewportWidthPx: input.viewportWidthPx,
  });
}

/** 使 `timeSec` 对齐主视口左缘时的 tier scrollLeft（overview 点击跳转）。 */
export function computeAlignScrollPxForTimeSec(input: {
  timeSec: number;
  timelineWidthPx: number;
  viewportWidthPx: number;
  durationSec: number;
  /** @deprecated 保留兼容；实际使用 timelineWidthPx / durationSec 投影 */
  pxPerSec?: number;
}): number {
  return scrollPxAlignTimeToViewportLeft({
    timeSec: input.timeSec,
    timelineWidthPx: input.timelineWidthPx,
    durationSec: input.durationSec,
    viewportWidthPx: input.viewportWidthPx,
  });
}

export function overviewClientXToTimeSec(
  clientX: number,
  rect: Pick<DOMRect, "left" | "width">,
  durationSec: number,
): number {
  const dur = Math.max(durationSec, 0);
  if (dur <= 0 || rect.width <= 0) return 0;
  const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  return ratio * dur;
}

/** Map segment times to overview strip pixels (same axis as playhead). */
export function overviewSegmentBarPx(
  startSec: number,
  endSec: number,
  durationSec: number,
  overviewWidthPx: number,
): { leftPx: number; widthPx: number } {
  const dur = Math.max(durationSec, 0.001);
  const ow = Math.max(1, overviewWidthPx);
  const lo = Math.min(startSec, endSec);
  const hi = Math.max(startSec, endSec);
  const leftPx = (Math.max(0, lo) / dur) * ow;
  const rightPx = (Math.min(dur, hi) / dur) * ow;
  return { leftPx, widthPx: Math.max(2, rightPx - leftPx) };
}
