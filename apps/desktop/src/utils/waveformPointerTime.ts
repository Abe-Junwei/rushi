/** 将屏幕 X 映射为时间轴像素偏移（容器已在 tier 滚动坐标系内，勿再加 scrollLeft）。 */
export function clientXToTimelinePx(clientX: number, containerViewportLeftPx: number): number {
  return clientX - containerViewportLeftPx;
}

export function timelinePxToTimeSec(
  timelinePx: number,
  pxPerSec: number,
  durationSec: number,
): number {
  const mps = Math.max(pxPerSec, 1e-6);
  const t = timelinePx / mps;
  const dur = Math.max(durationSec, 0);
  return Math.max(0, Math.min(t, dur > 0 ? dur : t));
}
