import { timelinePxToTime } from "./waveformProjection";

/** 将屏幕 X 映射为时间轴像素偏移（容器已在 tier 滚动坐标系内，勿再加 scrollLeft）。 */
export function clientXToTimelinePx(clientX: number, containerViewportLeftPx: number): number {
  return clientX - containerViewportLeftPx;
}

/** Map screen X to timeline seconds via tier scroll (overlay gesture authority). */
export function clientXToTimeSecInTierScroll(input: {
  clientX: number;
  tierViewportLeftPx: number;
  tierScrollLeftPx: number;
  timelineWidthPx: number;
  durationSec: number;
  contentOffsetLeftPx?: number;
}): number {
  const { clientX, tierViewportLeftPx, tierScrollLeftPx, timelineWidthPx, durationSec } = input;
  if (timelineWidthPx <= 0 || durationSec <= 0) return 0;
  const relPx =
    clientX - tierViewportLeftPx + tierScrollLeftPx - (input.contentOffsetLeftPx ?? 0);
  return timelinePxToTime(relPx, timelineWidthPx, durationSec);
}
