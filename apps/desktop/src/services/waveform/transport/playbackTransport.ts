/**
 * Single media playback host for Transport Authority.
 * Desktop: Rust native (S4) is the sole play true-source.
 * Non-Tauri browser may still use WaveSurfer MediaElement for smoke/dev.
 */

export type PlaybackTransportKind = "wavesurfer" | "native";

export type PlaybackTransportEvents = {
  onPlay?: () => void;
  onPause?: () => void;
  onFinish?: () => void;
  onTimeUpdate?: (timeSec: number) => void;
  onSeeked?: (timeSec: number) => void;
  onReady?: (durationSec: number) => void;
  onError?: (message: string) => void;
  /** Soft device route change / rebuild (non-fatal). */
  onDeviceChanged?: (message: string) => void;
  /** Soft underrun telemetry (non-fatal). */
  onUnderrun?: (consecutive: number) => void;
};

export type PlaybackTransportLoadInput = {
  mediaDiskPath: string;
  durationSec: number;
};

export type PlaybackTransport = {
  readonly kind: PlaybackTransportKind;
  /** Native: open file. WaveSurfer: usually no-op (URL already on create). */
  load(input: PlaybackTransportLoadInput): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  seek(timeSec: number): Promise<void>;
  setRate(rate: number): Promise<void>;
  /** Authoritative latch from last engine Seeked/TimeUpdate. */
  getCurrentTime(): number;
  /**
   * Display-only playhead. Native may interpolate between TimeUpdate anchors;
   * never use this value as seek/pause authority.
   */
  getDisplayTime(): number;
  isPlaying(): boolean;
  getDuration(): number;
  subscribe(handlers: PlaybackTransportEvents): () => void;
  dispose(): Promise<void>;
};

/** Narrow sink for {@link dispatchTransportIntent}. */
export function transportAsMediaSink(transport: PlaybackTransport): {
  setTime: (timeSec: number) => Promise<void>;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  isPlaying: () => boolean;
} {
  return {
    setTime: (timeSec) => transport.seek(timeSec),
    play: () => transport.play(),
    pause: () => transport.pause(),
    isPlaying: () => transport.isPlaying(),
  };
}
