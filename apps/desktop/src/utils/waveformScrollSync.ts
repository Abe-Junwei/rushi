/** 程序化滚动后，短暂忽略 WaveSurfer scroll 事件，避免覆盖 tier 定位。 */
export const WAVEFORM_PROGRAMMATIC_SCROLL_SUPPRESS_MS = 400;

/** tier ↔ waveform scroll 视为相同的像素阈值（避免 subpixel 级联同步）。 */
export const WAVEFORM_SCROLL_SYNC_EPSILON_PX = 0.5;

export function shouldSuppressWaveformScrollSync(suppressUntilMs: number, nowMs = performance.now()): boolean {
  return nowMs < suppressUntilMs;
}

/** 按滚动距离估算 suppress 时长，长距离 smooth scroll 覆盖更久。 */
export function computeProgrammaticScrollSuppressMs(scrollDeltaPx: number): number {
  const delta = Math.abs(scrollDeltaPx);
  return Math.min(4000, Math.max(WAVEFORM_PROGRAMMATIC_SCROLL_SUPPRESS_MS, delta * 0.25 + 400));
}
