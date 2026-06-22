/** Monotonic playhead clock for rAF-driven UI (WaveSurfer media time can be 4–250ms quantized). */

export type VisualPlayheadClockState = {
  /** Last emitted visual time — the monotonic anchor we extrapolate from. */
  emittedSec: number;
  emittedNowMs: number;
  lastRawSec: number;
  /** Monotonic clock when {@link lastRawSec} last changed (sparse WS samples). */
  lastRawNowMs: number;
};

export function createVisualPlayheadClockState(timeSec: number, nowMs = performance.now()): VisualPlayheadClockState {
  const clamped = Math.max(0, timeSec);
  return {
    emittedSec: clamped,
    emittedNowMs: nowMs,
    lastRawSec: clamped,
    lastRawNowMs: nowMs,
  };
}

/** Max the visual clock may lead raw media time when raw was sampled recently. */
const MAX_LEAD_SEC = 0.05;
/** Allow more extrapolation when raw samples are sparse (WaveSurfer can quantize 50–250ms). */
const MAX_STALE_RAW_LEAD_SEC = 0.24;
/** Raw moved back at least this far ⇒ genuine backward seek (snap). */
const BACKWARD_SEEK_SEC = 0.2;
/** Raw leapt ahead of prediction by at least this much ⇒ genuine forward seek (snap). */
const FORWARD_JUMP_SEC = 0.35;

function resolveMaxLeadSec(rawAgeSec: number, playbackRate: number): number {
  if (rawAgeSec <= 0.04) return MAX_LEAD_SEC;
  return Math.min(MAX_STALE_RAW_LEAD_SEC, MAX_LEAD_SEC + rawAgeSec * playbackRate);
}

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
    s.lastRawNowMs = input.nowMs;
    return raw;
  }

  // Normal forward WS timeupdate: anchor to raw immediately so extrapolation never trails.
  if (raw > s.lastRawSec + 1e-4) {
    s.emittedSec = raw;
    s.emittedNowMs = input.nowMs;
    s.lastRawSec = raw;
    s.lastRawNowMs = input.nowMs;
    return raw;
  }

  const rawAgeSec = Math.max(0, (input.nowMs - s.lastRawNowMs) / 1000);
  const maxLead = resolveMaxLeadSec(rawAgeSec, rate);

  // Between quantized raw samples: extrapolate forward, never trail last raw.
  let next = Math.min(predicted, s.lastRawSec + maxLead);
  next = Math.max(next, s.emittedSec, s.lastRawSec);
  if (dur > 0) next = Math.min(next, dur);

  s.emittedSec = next;
  s.emittedNowMs = input.nowMs;
  s.lastRawSec = raw;
  return next;
}
