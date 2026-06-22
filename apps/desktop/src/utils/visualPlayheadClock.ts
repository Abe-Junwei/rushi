/** Monotonic playhead clock for rAF-driven UI (WaveSurfer media time can be 4–250ms quantized). */

export type VisualPlayheadClockState = {
  /** Last raw media time sample — the anchor we extrapolate from. */
  rawSec: number;
  /** Monotonic clock when {@link rawSec} was last sampled. */
  rawAtMs: number;
};

export function createVisualPlayheadClockState(timeSec: number, nowMs = performance.now()): VisualPlayheadClockState {
  const clamped = Math.max(0, timeSec);
  return {
    rawSec: clamped,
    rawAtMs: nowMs,
  };
}

/** Max the visual clock may lead the last raw sample during normal playback. */
const MAX_LEAD_SEC = 0.05;
/** Raw moved back at least this far ⇒ genuine backward seek (snap). */
const BACKWARD_SEEK_SEC = 0.2;
/** Raw leapt ahead of prediction by at least this much ⇒ genuine forward seek (snap). */
const FORWARD_JUMP_SEC = 0.35;

export function readVisualPlayheadTimeSec(input: {
  state: VisualPlayheadClockState;
  nowMs: number;
  rawTimeSec: number;
  durationSec: number;
  playbackRate: number;
}): number {
  const dur = Math.max(input.durationSec, 0);
  const rate = Number.isFinite(input.playbackRate) ? input.playbackRate : 1;
  const raw = dur > 0 ? Math.max(0, Math.min(dur, input.rawTimeSec)) : Math.max(0, input.rawTimeSec);
  const s = input.state;

  // Predict where we should be based on the last raw sample.
  const elapsedSec = Math.max(0, (input.nowMs - s.rawAtMs) / 1000);
  const predicted = s.rawSec + elapsedSec * rate;

  // Genuine seek (backward, or a large forward leap): snap straight to raw.
  if (raw < s.rawSec - BACKWARD_SEEK_SEC || raw > predicted + FORWARD_JUMP_SEC) {
    s.rawSec = raw;
    s.rawAtMs = input.nowMs;
    return raw;
  }

  // Normal playback: advance the raw anchor only when the media element confirms
  // it has moved forward. This avoids snapping the visual playhead backward when
  // a sparse WS timeupdate arrives after rAF has already extrapolated ahead.
  if (raw > s.rawSec) {
    s.rawSec = raw;
    s.rawAtMs = input.nowMs;
  }

  // Between quantized raw samples: extrapolate forward from the last raw anchor,
  // but cap the lead so we never drift far from the media clock.
  const leadSec = Math.max(0, (input.nowMs - s.rawAtMs) / 1000) * rate;
  let next = Math.min(s.rawSec + leadSec, s.rawSec + MAX_LEAD_SEC);
  next = Math.max(next, s.rawSec);
  if (dur > 0) next = Math.min(next, dur);

  return next;
}
