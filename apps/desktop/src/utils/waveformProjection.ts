/**
 * Single horizontal time↔pixel projection authority for the waveform timeline.
 *
 * Background (root-cause of recurring overlay/peaks misalignment): the timeline
 * had *two* coordinate families that only agreed by accident:
 *   - ratio family   — scroll-fit / ruler / WS timeline width:
 *                       `px = (time / duration) * timelineWidthPx`
 *   - nominal family — segment overlay / playback controls / click-to-seek:
 *                       `px = time * pxPerSec`
 * These diverge whenever `timelineWidthPx !== duration * pxPerSec` (e.g. `Math.ceil`
 * on timeline width). The result was segment overlay drifting off the peaks.
 *
 * Fix: everyone projects through `timelineWidthPx` (the actual rendered content
 * width). `effectiveTimelinePxPerSec` is the one scale that makes the nominal
 * formula identical to the ratio formula, so callers that still want a px/s
 * value (overlay, playback controls, hit-test) stay consistent with the tiles.
 */

const MIN_DURATION_SEC = 1e-3;

/**
 * The px/s implied by the actual rendered timeline width:
 * `timelineWidthPx / duration`. Use this — not the nominal zoom px/s — anywhere
 * a segment/handle/control is positioned as `time * pxPerSec`, so it lands on
 * the same pixel as the peaks drawn across `timelineWidthPx`.
 */
export function effectiveTimelinePxPerSec(
  timelineWidthPx: number,
  durationSec: number,
): number {
  const dur = Math.max(durationSec, MIN_DURATION_SEC);
  const width = Math.max(timelineWidthPx, 1);
  return width / dur;
}

/** Project a time (sec) to a timeline pixel offset (ratio over the rendered width). */
export function timeToTimelinePx(
  timeSec: number,
  timelineWidthPx: number,
  durationSec: number,
): number {
  const dur = Math.max(durationSec, MIN_DURATION_SEC);
  const clamped = Math.max(0, Math.min(timeSec, dur));
  return (clamped / dur) * Math.max(timelineWidthPx, 0);
}

/** Inverse of {@link timeToTimelinePx}: timeline pixel offset → time (sec). */
export function timelinePxToTime(
  timelinePx: number,
  timelineWidthPx: number,
  durationSec: number,
): number {
  const dur = Math.max(durationSec, MIN_DURATION_SEC);
  const width = Math.max(timelineWidthPx, 1);
  const ratio = Math.max(0, Math.min(timelinePx / width, 1));
  return ratio * dur;
}

/** Visible [start, end] time (sec) for a tier scroll position. */
export function visibleTimeWindowFromScroll(input: {
  scrollLeftPx: number;
  viewportWidthPx: number;
  timelineWidthPx: number;
  durationSec: number;
}): { start: number; end: number } {
  const dur = Math.max(input.durationSec, MIN_DURATION_SEC);
  const tw = Math.max(input.timelineWidthPx, 1);
  const sl = Math.max(0, input.scrollLeftPx);
  const vw = Math.max(1, input.viewportWidthPx);
  return {
    start: (sl / tw) * dur,
    end: Math.min(dur, ((sl + vw) / tw) * dur),
  };
}

/** Visible window expanded by N× viewport span — for scroll-track ruler tick prefetch. */
export function paddedVisibleTimeWindow(
  input: {
    scrollLeftPx: number;
    viewportWidthPx: number;
    timelineWidthPx: number;
    durationSec: number;
  },
  paddingViewportMul = 1.5,
): { start: number; end: number } {
  const view = visibleTimeWindowFromScroll(input);
  const span = Math.max(view.end - view.start, MIN_DURATION_SEC);
  const pad = span * paddingViewportMul;
  const dur = Math.max(input.durationSec, MIN_DURATION_SEC);
  return {
    start: Math.max(0, view.start - pad),
    end: Math.min(dur, view.end + pad),
  };
}

/** Tier scrollLeft that places `timeSec` on the viewport left edge. */
export function scrollPxAlignTimeToViewportLeft(input: {
  timeSec: number;
  timelineWidthPx: number;
  durationSec: number;
  viewportWidthPx: number;
}): number {
  const vw = Math.max(1, input.viewportWidthPx);
  const tw = Math.max(input.timelineWidthPx, 0);
  const maxSl = Math.max(0, tw - vw);
  const target = timeToTimelinePx(input.timeSec, tw, input.durationSec);
  return Math.max(0, Math.min(maxSl, target));
}

/** Tier scrollLeft that centers `timeSec` in the viewport. */
export function scrollPxCenterTimeInViewport(input: {
  timeSec: number;
  timelineWidthPx: number;
  durationSec: number;
  viewportWidthPx: number;
}): number {
  const vw = Math.max(1, input.viewportWidthPx);
  const tw = Math.max(input.timelineWidthPx, 0);
  const maxSl = Math.max(0, tw - vw);
  const playheadPx = timeToTimelinePx(input.timeSec, tw, input.durationSec);
  return Math.max(0, Math.min(maxSl, playheadPx - vw / 2));
}

/** Tier scrollLeft that preserves the viewport center time when timeline width changes. */
export function scrollPxPreservingViewportCenterTime(input: {
  scrollLeftPx: number;
  oldTimelineWidthPx: number;
  newTimelineWidthPx: number;
  durationSec: number;
  viewportWidthPx: number;
}): number {
  const dur = Math.max(input.durationSec, MIN_DURATION_SEC);
  const oldTw = Math.max(input.oldTimelineWidthPx, 1);
  const newTw = Math.max(input.newTimelineWidthPx, 1);
  const vw = Math.max(1, input.viewportWidthPx);
  const sl = Math.max(0, input.scrollLeftPx);
  const centerPx = sl + vw / 2;
  const centerTimeSec = (centerPx / oldTw) * dur;
  const newCenterPx = (centerTimeSec / dur) * newTw;
  const maxSl = Math.max(0, newTw - vw);
  return Math.max(0, Math.min(maxSl, newCenterPx - vw / 2));
}

/** Playhead position as % of timeline width (for ruler / live clock). */
export function playheadTimelineLeftPct(
  timeSec: number,
  timelineWidthPx: number,
  durationSec: number,
): number {
  const tw = Math.max(timelineWidthPx, 1);
  const px = timeToTimelinePx(timeSec, tw, durationSec);
  return Math.max(-1, Math.min(101, (px / tw) * 100));
}

/** Playhead x in tier viewport coordinates (sticky embedded ruler). */
export function playheadViewportLeftPx(
  timeSec: number,
  scrollLeftPx: number,
  timelineWidthPx: number,
  durationSec: number,
): number {
  return timelinePxToViewportPx(
    timeToTimelinePx(timeSec, timelineWidthPx, durationSec),
    scrollLeftPx,
  );
}

/** Timeline pixel offset → tier viewport x (sticky overlay / ruler). */
function timelinePxToViewportPx(timelinePx: number, scrollLeftPx: number): number {
  return timelinePx - Math.max(0, scrollLeftPx);
}

/** Embedded overlay viewport ruler: viewport coords + imperative delta translate (see WaveformTimeRuler). */
export function embeddedRulerPlayheadUsesTimelineCoords(input: {
  appearance?: "ink" | "light" | "embedded";
  coordinateSpace?: "timeline" | "viewport";
  overlayOnWaveform?: boolean;
}): boolean {
  void input;
  return false;
}
