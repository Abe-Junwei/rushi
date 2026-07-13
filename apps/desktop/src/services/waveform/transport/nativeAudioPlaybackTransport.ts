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

  const emit = (fn: (h: PlaybackTransportEvents) => void) => {
    for (const h of listeners) fn(h);
  };

  const anchorTime = (sec: number) => {
    currentTimeSec = sec;
    lastEventSec = sec;
    lastEventAtMs = performance.now();
    if (sec >= lastDisplaySec) {
      lastDisplaySec = sec;
    }
  };

  const emitReady = (sec: number) => {
    if (readyEmitted || disposed) return;
    readyEmitted = true;
    durationSec = sec > 0 ? sec : durationSec;
    anchorTime(currentTimeSec);
    emit((h) => h.onReady?.(durationSec));
  };

  const computeDisplayTime = (): number => {
    if (!playing || lastEventAtMs <= 0) {
      // While paused, keep the frozen high-water mark — never snap back to a
      // lagging TimeUpdate latch (that caused playhead rewind on pause/resume).
      return Math.max(currentTimeSec, lastDisplaySec);
    }
    const elapsedSec = ((performance.now() - lastEventAtMs) / 1000) * rate;
    let next = lastEventSec + elapsedSec;
    if (durationSec > 0) {
      next = Math.min(next, durationSec);
    }
    // Monotonic clamp: never let display jump backwards between anchors.
    if (next < lastDisplaySec) {
      return lastDisplaySec;
    }
    lastDisplaySec = next;
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
        lastDisplaySec = resumeSec;
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
        lastDisplaySec = freezeSec;
        emit((h) => h.onPause?.());
        break;
      }
      case "seeked": {
        anchorTime(ev.data.sec);
        lastDisplaySec = ev.data.sec;
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
          lastDisplaySec = durationSec;
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
      lastDisplaySec = snap.currentTimeSec;
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
        lastDisplaySec = Math.max(lastDisplaySec, currentTimeSec);
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
