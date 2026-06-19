/** Programmatic tier scroll: briefly pause playback-follow after viewport fit. */
export const WAVEFORM_PROGRAMMATIC_SCROLL_SUPPRESS_MS = 400;

/** Tier scroll writes ignore sub-pixel jitter below this threshold. */
export const WAVEFORM_SCROLL_SYNC_EPSILON_PX = 0.5;

/** Extend suppress window for larger programmatic jumps. */
export function computeProgrammaticScrollSuppressMs(scrollDeltaPx: number): number {
  const delta = Math.abs(scrollDeltaPx);
  return Math.min(4000, Math.max(WAVEFORM_PROGRAMMATIC_SCROLL_SUPPRESS_MS, delta * 0.25 + 400));
}

export function clampTimelineScrollLeftPx(input: {
  scrollLeftPx: number;
  timelineWidthPx: number;
  viewportWidthPx: number;
}): number {
  const tw = Math.max(input.timelineWidthPx, 1);
  const vw = Math.max(1, input.viewportWidthPx);
  const maxSl = Math.max(0, tw - vw);
  return Math.max(0, Math.min(maxSl, input.scrollLeftPx));
}
