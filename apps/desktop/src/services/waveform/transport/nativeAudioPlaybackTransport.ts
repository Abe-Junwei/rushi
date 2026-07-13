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

/**
 * S4 adapter: Rust CPAL+Symphonia is the sole play true-source.
 * Clock and play/pause state come from ordered Channel events (no poll/grace).
 */
export function createNativeAudioPlaybackTransport(): PlaybackTransport {
  const listeners = new Set<PlaybackTransportEvents>();
  let playing = false;
  let currentTimeSec = 0;
  let durationSec = 0;
  let disposed = false;
  let readyEmitted = false;

  const emit = (fn: (h: PlaybackTransportEvents) => void) => {
    for (const h of listeners) fn(h);
  };

  const emitReady = (sec: number) => {
    if (readyEmitted || disposed) return;
    readyEmitted = true;
    durationSec = sec > 0 ? sec : durationSec;
    emit((h) => h.onReady?.(durationSec));
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
        emit((h) => h.onPlay?.());
        break;
      }
      case "paused": {
        playing = false;
        emit((h) => h.onPause?.());
        break;
      }
      case "seeked": {
        currentTimeSec = ev.data.sec;
        emit((h) => h.onTimeUpdate?.(currentTimeSec));
        break;
      }
      case "timeUpdate": {
        currentTimeSec = ev.data.sec;
        emit((h) => h.onTimeUpdate?.(currentTimeSec));
        break;
      }
      case "ended": {
        playing = false;
        emit((h) => h.onPause?.());
        emit((h) => h.onFinish?.());
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
      currentTimeSec = snap.currentTimeSec;
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
      await nativeAudioPlay();
    },
    async pause() {
      if (disposed) return;
      await nativeAudioPause();
    },
    async seek(timeSec: number) {
      if (disposed) return;
      await nativeAudioSeek(timeSec);
      // Seeked/TimeUpdate events update mirror; keep local hint for sync callers.
      currentTimeSec = timeSec;
    },
    async setRate(rate: number) {
      if (disposed) return;
      await nativeAudioSetRate(rate);
    },
    getCurrentTime() {
      return currentTimeSec;
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
