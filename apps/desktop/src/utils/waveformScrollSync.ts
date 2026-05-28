/** 程序化滚动后，短暂忽略 WaveSurfer scroll 事件，避免覆盖 tier 定位。 */
export const WAVEFORM_PROGRAMMATIC_SCROLL_SUPPRESS_MS = 400;

/** tier ↔ waveform scroll 视为相同的像素阈值（避免 subpixel 级联同步）。 */
export const WAVEFORM_SCROLL_SYNC_EPSILON_PX = 0.5;

/**
 * Reverse-sync threshold (waveform → tier). Larger than the forward EPSILON
 * because WaveSurfer rounds its internal scroll position to sub-pixel values
 * that differ from the integer-rounded tier `scrollLeft` after every user
 * scroll. With a 0.5px threshold the cascade `user-scroll → tier → ws → ws-scroll
 * event → tier write-back` snapped the tier back by 1-2px on every fling stop
 * (visible as a flicker on long audio where the rounding delta is largest).
 *
 * Tuned to 4 px: small enough that playback autoScroll (which advances >> 4px
 * per second) keeps the tier in lock-step, large enough to swallow all
 * sub-integer WaveSurfer rounding noise.
 */
export const WAVEFORM_SCROLL_REVERSE_SYNC_EPSILON_PX = 4;

export function shouldSuppressWaveformScrollSync(suppressUntilMs: number, nowMs = performance.now()): boolean {
  return nowMs < suppressUntilMs;
}

/** 按滚动距离估算 suppress 时长，长距离 smooth scroll 覆盖更久。 */
export function computeProgrammaticScrollSuppressMs(scrollDeltaPx: number): number {
  const delta = Math.abs(scrollDeltaPx);
  return Math.min(4000, Math.max(WAVEFORM_PROGRAMMATIC_SCROLL_SUPPRESS_MS, delta * 0.25 + 400));
}
