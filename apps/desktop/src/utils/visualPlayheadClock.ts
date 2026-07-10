/**
 * Playhead clock state — single time source (no extrapolation).
 *
 * WaveSurfer v7 and Peaks.js both drive playhead from rAF readings of
 * `media.currentTime` without extrapolation; Rushi follows the same approach.
 * `syncPausedTime` anchors the clock after pause/seek so that Chromium's
 * `media.currentTime` rollback on `pause()` is corrected.
 */

export type VisualPlayheadClockState = {
  /** Last anchored time. */
  rawSec: number;
};

export function createVisualPlayheadClockState(timeSec: number): VisualPlayheadClockState {
  return { rawSec: Math.max(0, timeSec) };
}

/** No-op kept for API compat — returns `rawTimeSec` directly. */
export function readVisualPlayheadTimeSec(input: {
  state: VisualPlayheadClockState;
  nowMs: number;
  rawTimeSec: number;
  durationSec: number;
  playbackRate: number;
}): number {
  const dur = Math.max(input.durationSec, 0);
  return dur > 0 ? Math.max(0, Math.min(input.rawTimeSec, dur)) : Math.max(0, input.rawTimeSec);
}
