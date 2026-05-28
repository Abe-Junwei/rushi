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
  return Math.max(1, overviewWidthPx) / sec;
}

/** 使 `timeSec` 位于主视图视口水平中央时的 tier scrollLeft。 */
export function computeCenterScrollPxForTimeSec(input: {
  timeSec: number;
  pxPerSec: number;
  timelineWidthPx: number;
  viewportWidthPx: number;
}): number {
  const vw = Math.max(1, input.viewportWidthPx);
  const maxSl = Math.max(0, input.timelineWidthPx - vw);
  const target = input.timeSec * input.pxPerSec - vw / 2;
  return Math.max(0, Math.min(maxSl, target));
}

/** 使 `timeSec` 对齐主视口左缘时的 tier scrollLeft（overview 点击跳转）。 */
export function computeAlignScrollPxForTimeSec(input: {
  timeSec: number;
  pxPerSec: number;
  timelineWidthPx: number;
  viewportWidthPx: number;
}): number {
  const vw = Math.max(1, input.viewportWidthPx);
  const maxSl = Math.max(0, input.timelineWidthPx - vw);
  const target = input.timeSec * input.pxPerSec;
  return Math.max(0, Math.min(maxSl, target));
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

export function overviewSegmentBarPx(
  startSec: number,
  endSec: number,
  overviewPxPerSec: number,
): { leftPx: number; widthPx: number } {
  const lo = Math.min(startSec, endSec);
  const hi = Math.max(startSec, endSec);
  const leftPx = lo * overviewPxPerSec;
  const widthPx = Math.max(2, (hi - lo) * overviewPxPerSec);
  return { leftPx, widthPx };
}
