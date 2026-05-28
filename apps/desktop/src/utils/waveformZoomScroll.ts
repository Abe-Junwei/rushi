import { computeTimelineWidthPx } from "./segmentLayout";

/** 缩放变更时保留 tier / WS 横向 scroll（像素钳制，不换算时间锚点）。 */
export function clampWaveformScrollLeftPx(input: {
  scrollLeftPx: number;
  pxPerSec: number;
  durationSec: number;
  viewportWidthPx: number;
}): number {
  const tw = computeTimelineWidthPx(input.durationSec, input.pxPerSec);
  const vw = Math.max(1, input.viewportWidthPx);
  const maxSl = Math.max(0, tw - vw);
  return Math.max(0, Math.min(maxSl, input.scrollLeftPx));
}

/** 读取当前可见横向 scroll：tier 与 WS 取较大值（缩放时保留 scroll 用）。 */
export function readVisibleWaveformScrollPx(
  wsScrollPx: number,
  viewportScrollPx?: number,
): number {
  return Math.max(viewportScrollPx ?? 0, wsScrollPx);
}
