import type WaveSurfer from "wavesurfer.js";
import type { PlaybackTransport } from "./playbackTransport";

/**
 * Unified media ops for Transport Authority sinks.
 * Desktop Tauri uses {@link PlaybackTransport} only (`requireTransport: true`).
 * Non-Tauri browser may still use WaveSurfer MediaElement for smoke/dev.
 */
export type MediaPlaybackHost = {
  play: () => Promise<void> | void;
  pause: () => void | Promise<void>;
  /** Native seek is async IPC — callers in play paths must await when Promise. */
  setTime: (timeSec: number) => void | Promise<void>;
  getCurrentTime: () => number;
  isPlaying: () => boolean;
  setPlaybackRate: (rate: number) => void | Promise<void>;
  /** Key for {@link mediaPlayGate} WeakMap. */
  gateHost: object;
};

export type ResolveMediaPlaybackHostOptions = {
  /**
   * Desktop native mode: never fall back to WaveSurfer media ops.
   * Returns null until transport is loaded.
   */
  requireTransport?: boolean;
};

export function resolveMediaPlaybackHost(
  ws: WaveSurfer | null | undefined,
  transport: PlaybackTransport | null | undefined,
  options?: ResolveMediaPlaybackHostOptions,
): MediaPlaybackHost | null {
  if (transport) {
    return {
      play: () => transport.play(),
      pause: () => transport.pause(),
      setTime: (timeSec) => transport.seek(timeSec),
      getCurrentTime: () => transport.getCurrentTime(),
      isPlaying: () => transport.isPlaying(),
      setPlaybackRate: (rate) => transport.setRate(rate),
      gateHost: transport,
    };
  }
  if (options?.requireTransport) return null;
  if (!ws) return null;
  return {
    play: () => ws.play(),
    pause: () => {
      ws.pause();
    },
    setTime: (timeSec) => {
      ws.setTime(timeSec);
    },
    getCurrentTime: () => ws.getCurrentTime(),
    isPlaying: () => ws.isPlaying(),
    setPlaybackRate: (rate) => {
      ws.setPlaybackRate(rate);
    },
    gateHost: ws,
  };
}
