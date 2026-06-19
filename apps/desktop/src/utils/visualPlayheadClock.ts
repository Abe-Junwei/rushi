/** Monotonic playhead clock for rAF-driven UI (WaveSurfer media time can be 4–250ms quantized). */

export type VisualPlayheadClockState = {
  /** Last emitted visual time — the monotonic anchor we extrapolate from. */
  emittedSec: number;
  emittedNowMs: number;
  lastRawSec: number;
};

export function createVisualPlayheadClockState(timeSec: number, nowMs = performance.now()): VisualPlayheadClockState {
  const clamped = Math.max(0, timeSec);
  return {
    emittedSec: clamped,
    emittedNowMs: nowMs,
    lastRawSec: clamped,
  };
}

/** Max the visual clock may lead raw media time. Bounds startup over-prediction so we never run far ahead then snap back. */
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
  const elapsedSec = Math.max(0, (input.nowMs - s.emittedNowMs) / 1000);
  const predicted = s.emittedSec + elapsedSec * rate;

  // Genuine seek (backward, or a large forward leap): snap straight to raw.
  if (raw < s.lastRawSec - BACKWARD_SEEK_SEC || raw > predicted + FORWARD_JUMP_SEC) {
    s.emittedSec = raw;
    s.emittedNowMs = input.nowMs;
    s.lastRawSec = raw;
    return raw;
  }

  // Smooth forward: fill gaps between quantized raw samples, but never run more than
  // MAX_LEAD_SEC ahead of real media time (kills startup over-prediction + snap-back),
  // and never move backward during forward playback (monotonic).
  let next = Math.min(predicted, raw + MAX_LEAD_SEC);
  next = Math.max(next, s.emittedSec);
  if (dur > 0) next = Math.min(next, dur);

  s.emittedSec = next;
  s.emittedNowMs = input.nowMs;
  s.lastRawSec = raw;
  return next;
}
