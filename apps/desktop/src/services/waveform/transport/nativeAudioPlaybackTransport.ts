import { Channel } from "@tauri-apps/api/core";
import {
  nativeAudioLoad,
  nativeAudioPause,
  nativeAudioPlay,
  nativeAudioSeek,
  nativeAudioSetRate,
  nativeAudioStop,
  type NativeAudioEvent,
} from "../../../tauri/nativeAudioApi";
import type {
  PlaybackTransport,
  PlaybackTransportEvents,
  PlaybackTransportLoadInput,
} from "./playbackTransport";

/** Must cover Rust PREBUFFER_MS (120) plus IPC slack. */
const STATE_ACK_TIMEOUT_MS = 2_000;

/** Display smoothing time constant (s); FPS-decoupled convergence window. */
const DISPLAY_SMOOTH_TAU_SEC = 0.1;
/** Forward mismatch beyond this (s) is a genuine catch-up (underrun/resume) → jump. */
const DISPLAY_SMOOTH_MAX_DRIFT_SEC = 0.05;

/**
 * First-order low-pass tracking of the authority-projected time, with an
 * anti-rebound monotonic clamp. Converts the periodic high-water freeze
 * (on lagging `timeUpdate` re-anchors) into a smooth deceleration / plateau
 * so the `edge` playhead never micro-stutters or regresses.
 *
 * - `tvPrev` inertially advances at `rate`, then converges toward `taProjected`
 *   with an FPS-decoupled factor `1 − exp(−Δt/τ)` (zero steady-state error).
 * - Backward authority (stall) → `max(tvPrev, …)` plateaus, never rewinds.
 *   Genuine backward seeks re-anchor via the `seeked` event, not here.
 * - Forward mismatch > maxDrift (underrun/resume lag / suspended rAF) → jump
 *   forward to authority (monotonic-safe).
 * See docs/execution/specs/waveform-visual-clock-smoothing-research.md.
 */
export function computeSmoothDisplayStep(input: {
  tvPrev: number;
  taProjected: number;
  deltaSec: number;
  rate: number;
  tau?: number;
  maxDriftSec?: number;
}): number {
  const { tvPrev, taProjected, deltaSec, rate } = input;
  const tau = input.tau ?? DISPLAY_SMOOTH_TAU_SEC;
  const maxDrift = input.maxDriftSec ?? DISPLAY_SMOOTH_MAX_DRIFT_SEC;
  // First frame / background-suspended rAF: forward-safe re-anchor.
  if (deltaSec <= 0 || deltaSec > 0.1) {
    return Math.max(taProjected, tvPrev);
  }
  const tPredict = tvPrev + deltaSec * rate;
  // Fell behind (underrun / resume): jump forward to authority (monotonic-safe).
  if (taProjected - tPredict > maxDrift) {
    return Math.max(tvPrev, taProjected);
  }
  const alpha = 1 - Math.exp(-deltaSec / tau);
  const tFiltered = tPredict + alpha * (taProjected - tPredict);
  // Anti-rebound monotonic clamp: lagging authority → plateau, never regress.
  return Math.max(tvPrev, tFiltered);
}

type EventWaiter = {
  cancel: () => void;
  promise: Promise<void>;
};

/**
 * S4 adapter: Rust CPAL+Symphonia is the sole play true-source.
 * Clock and play/pause state come from ordered Channel events (no poll/grace).
 * Display time may interpolate between TimeUpdate anchors; seek/pause use latch.
 */
export function createNativeAudioPlaybackTransport(): PlaybackTransport {
  const listeners = new Set<PlaybackTransportEvents>();
  let playing = false;
  /** Authoritative latch from last Seeked/TimeUpdate/Ready. */
  let currentTimeSec = 0;
  let durationSec = 0;
  let rate = 1;
  let disposed = false;
  let readyEmitted = false;
  let lastEventSec = 0;
  let lastEventAtMs = 0;
  let lastDisplaySec = 0;
  /** performance.now() of the last display smoothing evaluation. */
  let lastEvaluationTimeMs = 0;

  const emit = (fn: (h: PlaybackTransportEvents) => void) => {
    for (const h of listeners) fn(h);
  };

  /** Authority latch only — display smoothing converges toward the projection. */
  const anchorTime = (sec: number) => {
    currentTimeSec = sec;
    lastEventSec = sec;
    lastEventAtMs = performance.now();
  };

  /** Hard-reset the smooth display clock (ready/resume/seek/rate/end). */
  const resetDisplayClock = (sec: number) => {
    lastDisplaySec = sec;
    lastEvaluationTimeMs = performance.now();
  };

  const emitReady = (sec: number) => {
    if (readyEmitted || disposed) return;
    readyEmitted = true;
    durationSec = sec > 0 ? sec : durationSec;
    anchorTime(currentTimeSec);
    resetDisplayClock(currentTimeSec);
    emit((h) => h.onReady?.(durationSec));
  };

  const computeDisplayTime = (): number => {
    if (!playing || lastEventAtMs <= 0) {
      // While paused, keep the frozen high-water mark — never snap back to a
      // lagging TimeUpdate latch (that caused playhead rewind on pause/resume).
      return Math.max(currentTimeSec, lastDisplaySec);
    }
    const now = performance.now();
    // Authority projection: the true audio line, extended at rate between the
    // jittery TimeUpdate anchors. The smoothing filter tracks this, absorbing
    // the sawtooth that a late/lagging re-anchor would otherwise inject.
    let taProjected = lastEventSec + ((now - lastEventAtMs) / 1000) * rate;
    if (durationSec > 0) {
      taProjected = Math.min(taProjected, durationSec);
    }
    const deltaSec = lastEvaluationTimeMs > 0 ? (now - lastEvaluationTimeMs) / 1000 : 0;
    let next = computeSmoothDisplayStep({
      tvPrev: lastDisplaySec,
      taProjected,
      deltaSec,
      rate,
    });
    if (durationSec > 0) {
      next = Math.min(next, durationSec);
    }
    lastDisplaySec = next;
    lastEvaluationTimeMs = now;
    return next;
  };

  const createEventWaiter = (
    subscribe: (resolve: () => void, reject: (message: string) => void) => PlaybackTransportEvents,
    label: string,
  ): EventWaiter => {
    if (disposed) {
      return {
        cancel: () => undefined,
        promise: Promise.reject(new Error("native audio transport disposed")),
      };
    }
    let settled = false;
    let handler: PlaybackTransportEvents | null = null;
    let timer: number | null = null;
    const cancel = () => {
      if (settled) return;
      settled = true;
      if (timer != null) {
        window.clearTimeout(timer);
        timer = null;
      }
      if (handler) listeners.delete(handler);
    };
    const promise = new Promise<void>((resolve, reject) => {
      const rejectWith = (message: string) => {
        if (settled) return;
        cancel();
        reject(new Error(message));
      };
      const resolveWith = () => {
        if (settled) return;
        cancel();
        resolve();
      };
      timer = window.setTimeout(() => {
        const msg = `native audio ${label} timed out`;
        emit((h) => h.onError?.(msg));
        rejectWith(msg);
      }, STATE_ACK_TIMEOUT_MS);

      handler = {
        ...subscribe(resolveWith, rejectWith),
        onError: (message) => rejectWith(message),
      };
      listeners.add(handler);
    });
    return { cancel, promise };
  };

  const applyEvent = (ev: NativeAudioEvent) => {
    if (disposed) return;
    switch (ev.event) {
      case "ready": {
        emitReady(ev.data.durationSec);
        break;
      }
      case "playing": {
        playing = true;
        // Resume from the frozen display high-water so playhead does not rewind
        // to a lagging TimeUpdate latch after pause.
        const resumeSec = Math.max(currentTimeSec, lastDisplaySec);
        currentTimeSec = resumeSec;
        lastEventSec = resumeSec;
        lastEventAtMs = performance.now();
        resetDisplayClock(resumeSec);
        emit((h) => h.onPlay?.());
        break;
      }
      case "paused": {
        // Freeze at interpolated display time before clearing playing — authority
        // TimeUpdate can lag the wall-clock display by up to one tick.
        const freezeSec = computeDisplayTime();
        playing = false;
        currentTimeSec = freezeSec;
        lastEventSec = freezeSec;
        lastEventAtMs = performance.now();
        resetDisplayClock(freezeSec);
        emit((h) => h.onPause?.());
        break;
      }
      case "seeked": {
        anchorTime(ev.data.sec);
        resetDisplayClock(ev.data.sec);
        emit((h) => h.onSeeked?.(currentTimeSec));
        emit((h) => h.onTimeUpdate?.(currentTimeSec));
        break;
      }
      case "timeUpdate": {
        anchorTime(ev.data.sec);
        emit((h) => h.onTimeUpdate?.(currentTimeSec));
        break;
      }
      case "ended": {
        playing = false;
        if (durationSec > 0) {
          anchorTime(durationSec);
          resetDisplayClock(durationSec);
        }
        emit((h) => h.onPause?.());
        emit((h) => h.onFinish?.());
        break;
      }
      case "underrun": {
        emit((h) => h.onUnderrun?.(ev.data.consecutive));
        break;
      }
      case "deviceChanged": {
        emit((h) => h.onDeviceChanged?.(ev.data.message));
        break;
      }
      case "error": {
        emit((h) => h.onError?.(ev.data.message));
        break;
      }
      default: {
        const _exhaustive: never = ev;
        void _exhaustive;
      }
    }
  };

  return {
    kind: "native",
    async load(input: PlaybackTransportLoadInput) {
      if (disposed) {
        throw new Error("native audio transport disposed");
      }
      readyEmitted = false;
      const channel = new Channel<NativeAudioEvent>();
      channel.onmessage = (ev) => applyEvent(ev);
      durationSec = input.durationSec;
      const snap = await nativeAudioLoad(input.mediaDiskPath, input.durationSec, channel);
      if (disposed) return;
      playing = snap.playing;
      rate = snap.rate > 0 ? snap.rate : 1;
      anchorTime(snap.currentTimeSec);
      resetDisplayClock(snap.currentTimeSec);
      if (snap.durationSec > 0) {
        durationSec = snap.durationSec;
      }
      // Ready may already have arrived via Channel; emit once if not yet.
      emitReady(durationSec);
    },
    async play() {
      if (disposed) {
        throw new Error("native audio transport disposed");
      }
      if (playing) return;
      const ack = createEventWaiter((resolve) => ({ onPlay: resolve }), "play");
      try {
        await nativeAudioPlay();
      } catch (err) {
        ack.cancel();
        throw err;
      }
      await ack.promise;
    },
    async pause() {
      if (disposed) return;
      if (!playing) return;
      const ack = createEventWaiter(
        (resolve) => ({ onPause: resolve, onFinish: resolve }),
        "pause",
      );
      try {
        await nativeAudioPause();
      } catch (err) {
        ack.cancel();
        throw err;
      }
      await ack.promise;
    },
    async seek(timeSec: number) {
      if (disposed) return;
      const target = timeSec;
      const ack = createEventWaiter(
        (resolve) => ({
          onSeeked: (sec) => {
            if (Math.abs(sec - target) < 0.05) resolve();
          },
        }),
        "seek",
      );
      try {
        await nativeAudioSeek(timeSec);
      } catch (err) {
        ack.cancel();
        throw err;
      }
      await ack.promise;
    },
    async setRate(nextRate: number) {
      if (disposed) return;
      // Re-anchor so display interpolation uses the new rate immediately.
      if (playing) {
        rate = nextRate;
        lastEventSec = currentTimeSec;
        lastEventAtMs = performance.now();
        resetDisplayClock(Math.max(lastDisplaySec, currentTimeSec));
      } else {
        rate = nextRate;
      }
      await nativeAudioSetRate(nextRate);
    },
    getCurrentTime() {
      return currentTimeSec;
    },
    getDisplayTime() {
      return computeDisplayTime();
    },
    isPlaying() {
      return playing;
    },
    getDuration() {
      return durationSec;
    },
    subscribe(handlers) {
      listeners.add(handlers);
      return () => {
        listeners.delete(handlers);
      };
    },
    async dispose() {
      disposed = true;
      listeners.clear();
      try {
        await nativeAudioStop();
      } catch {
        /* noop */
      }
      playing = false;
    },
  };
}
