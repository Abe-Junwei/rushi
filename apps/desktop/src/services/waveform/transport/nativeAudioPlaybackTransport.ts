import { Channel } from "@tauri-apps/api/core";
import {
  nativeAudioLoad,
  nativeAudioPause,
  nativeAudioPlay,
  nativeAudioSeek,
  nativeAudioSetRate,
  nativeAudioSnapshot,
  nativeAudioStop,
  type NativeAudioEvent,
} from "../../../tauri/nativeAudioApi";
import type {
  PlaybackTransport,
  PlaybackTransportEvents,
  PlaybackTransportLoadInput,
} from "./playbackTransport";
import { SEEK_SETTLE_WINDOW_MS } from "../../../utils/waveformSeekSettle";

/** Must cover Rust PREBUFFER_MS (120) plus IPC slack. */
const STATE_ACK_TIMEOUT_MS = 2_000;
/** Extra polls when Channel ACK is late (Windows debug / StrictMode remount). */
const SNAPSHOT_RECONCILE_ATTEMPTS = 4;
const SNAPSHOT_RECONCILE_GAP_MS = 250;
/** Seeked sec may be duration-clamped; accept any post-command Seeked. */
const SEEK_ACK_MATCH_SEC = 0.5;

/** Display smoothing time constant (s); FPS-decoupled convergence window. */
const DISPLAY_SMOOTH_TAU_SEC = 0.1;
/** Forward mismatch beyond this (s) is a genuine catch-up (underrun/resume) → jump. */
const DISPLAY_SMOOTH_MAX_DRIFT_SEC = 0.05;
/**
 * After an imperative seek, ignore TimeUpdate anchors that are still far from the
 * seek target. A lagging pre-seek tick would otherwise re-anchor authority ahead of
 * the new position; the smooth display then forward-jumps (maxDrift) and the
 * playhead thrashs for a few frames after click-seek while playing.
 *
 * Both post-seek windows share {@link SEEK_SETTLE_WINDOW_MS} (and the same seeked-ACK
 * anchor as the UI grounding/follow-suppress) so every settle guard releases in the
 * same frame — no staggered corrections that read as left-right flicker at high zoom.
 */
const SEEK_STALE_GUARD_MS = SEEK_SETTLE_WINDOW_MS;
const SEEK_STALE_GUARD_TOLERANCE_SEC = 0.35;
/**
 * After seek, keep maxDrift jumps off for the settle window. Decode underrun/resume
 * catch-ups inside it would otherwise forward-jump display by ≥50ms — at high px/s
 * that is a violent multi-frame thrash.
 */
const SEEK_SETTLE_NO_JUMP_MS = SEEK_SETTLE_WINDOW_MS;

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
  /** Wall-clock deadline for discarding stale TimeUpdates after seek. */
  let seekStaleGuardUntilMs = 0;
  let seekStaleGuardTargetSec = 0;
  /** Wall-clock deadline: smooth without maxDrift forward jumps after seek. */
  let seekSettleNoJumpUntilMs = 0;

  const emit = (fn: (h: PlaybackTransportEvents) => void) => {
    for (const h of [...listeners]) fn(h);
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

  const armSeekStaleGuard = (targetSec: number) => {
    const now = performance.now();
    seekStaleGuardTargetSec = targetSec;
    seekStaleGuardUntilMs = now + SEEK_STALE_GUARD_MS;
    seekSettleNoJumpUntilMs = now + SEEK_SETTLE_NO_JUMP_MS;
  };

  const isStalePostSeekTimeUpdate = (sec: number): boolean => {
    if (performance.now() >= seekStaleGuardUntilMs) return false;
    return Math.abs(sec - seekStaleGuardTargetSec) > SEEK_STALE_GUARD_TOLERANCE_SEC;
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
      // Soft converge only — underrun catch-up jumps amplify violently at high zoom.
      maxDriftSec: now < seekSettleNoJumpUntilMs ? Number.POSITIVE_INFINITY : undefined,
    });
    if (durationSec > 0) {
      next = Math.min(next, durationSec);
    }
    lastDisplaySec = next;
    lastEvaluationTimeMs = now;
    return next;
  };

  const sleepMs = (ms: number) =>
    new Promise<void>((resolve) => {
      window.setTimeout(resolve, ms);
    });

  const createEventWaiter = (
    subscribe: (resolve: () => void, reject: (message: string) => void) => PlaybackTransportEvents,
    label: string,
    opts?: { emitErrorOnTimeout?: boolean },
  ): EventWaiter => {
    if (disposed) {
      return {
        cancel: () => undefined,
        promise: Promise.reject(new Error("native audio transport disposed")),
      };
    }
    const emitErrorOnTimeout = opts?.emitErrorOnTimeout ?? true;
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
        // Recoverable ACK misses reconcile via snapshot — do not poison loadError.
        if (emitErrorOnTimeout) {
          emit((h) => h.onError?.(msg));
        }
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

  /**
   * When Channel ACK is late/missing, adopt engine snapshot so UI clock can start.
   * `softFail`: return without throwing (seek already has an optimistic latch).
   */
  const awaitAckOrSnapshot = async (
    ack: EventWaiter,
    reconcile: () => Promise<boolean>,
    label: string,
    opts?: { softFail?: boolean },
  ): Promise<boolean> => {
    try {
      await ack.promise;
      return true;
    } catch {
      /* try snapshot reconcile below */
    }
    if (disposed) return true;
    for (let i = 0; i < SNAPSHOT_RECONCILE_ATTEMPTS; i += 1) {
      if (await reconcile()) return true;
      if (i + 1 < SNAPSHOT_RECONCILE_ATTEMPTS) {
        await sleepMs(SNAPSHOT_RECONCILE_GAP_MS);
      }
      if (disposed) return true;
    }
    if (opts?.softFail) return false;
    const msg = `native audio ${label} timed out`;
    emit((h) => h.onError?.(msg));
    throw new Error(msg);
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
        armSeekStaleGuard(ev.data.sec);
        anchorTime(ev.data.sec);
        resetDisplayClock(ev.data.sec);
        emit((h) => h.onSeeked?.(currentTimeSec));
        emit((h) => h.onTimeUpdate?.(currentTimeSec));
        break;
      }
      case "timeUpdate": {
        // Drop lagging pre-seek ticks — they re-anchor authority far from the new
        // latch and the display smoother forward-jumps the playhead.
        if (isStalePostSeekTimeUpdate(ev.data.sec)) {
          break;
        }
        if (performance.now() < seekStaleGuardUntilMs) {
          // Confirmed near-target tick — release guard early.
          seekStaleGuardUntilMs = 0;
        }
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
      const ack = createEventWaiter((resolve) => ({ onPlay: resolve }), "play", {
        emitErrorOnTimeout: false,
      });
      try {
        await nativeAudioPlay();
      } catch (err) {
        ack.cancel();
        throw err;
      }
      await awaitAckOrSnapshot(
        ack,
        async () => {
          if (playing) return true;
          try {
            const snap = await nativeAudioSnapshot();
            if (disposed) return true;
            if (snap.playing) {
              applyEvent({ event: "playing" });
              return true;
            }
          } catch {
            /* keep polling */
          }
          return false;
        },
        "play",
      );
    },
    async pause() {
      if (disposed) return;
      if (!playing) return;
      const ack = createEventWaiter(
        (resolve) => ({ onPause: resolve, onFinish: resolve }),
        "pause",
        { emitErrorOnTimeout: false },
      );
      try {
        await nativeAudioPause();
      } catch (err) {
        ack.cancel();
        throw err;
      }
      await awaitAckOrSnapshot(
        ack,
        async () => {
          if (!playing) return true;
          try {
            const snap = await nativeAudioSnapshot();
            if (disposed) return true;
            if (!snap.playing) {
              applyEvent({ event: "paused" });
              return true;
            }
          } catch {
            /* keep polling */
          }
          return false;
        },
        "pause",
      );
    },
    async seek(timeSec: number) {
      if (disposed) return;
      const target = timeSec;
      // Optimistic re-anchor: do not keep extrapolating the pre-seek line while
      // IPC/decode catch up — that left display far ahead of the UI seek latch.
      armSeekStaleGuard(target);
      anchorTime(target);
      resetDisplayClock(target);
      const ack = createEventWaiter(
        (resolve) => ({
          onSeeked: (sec) => {
            // Duration clamp / decode snap can land slightly off the request.
            if (Math.abs(sec - target) <= SEEK_ACK_MATCH_SEC) resolve();
          },
        }),
        "seek",
        { emitErrorOnTimeout: false },
      );
      try {
        await nativeAudioSeek(timeSec);
      } catch (err) {
        ack.cancel();
        throw err;
      }
      const ok = await awaitAckOrSnapshot(
        ack,
        async () => {
          try {
            const snap = await nativeAudioSnapshot();
            if (disposed) return true;
            const sec = snap.currentTimeSec;
            armSeekStaleGuard(sec);
            anchorTime(sec);
            resetDisplayClock(sec);
            emit((h) => h.onSeeked?.(sec));
            emit((h) => h.onTimeUpdate?.(sec));
            return true;
          } catch {
            return false;
          }
        },
        "seek",
        { softFail: true },
      );
      if (!ok) {
        // Optimistic latch already applied — keep UI seekable under Channel stalls.
        emit((h) => h.onSeeked?.(target));
        emit((h) => h.onTimeUpdate?.(target));
      }
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
