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
  onReady?: (durationSec: number) => void;
  onError?: (message: string) => void;
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
  getCurrentTime(): number;
  isPlaying(): boolean;
  getDuration(): number;
  subscribe(handlers: PlaybackTransportEvents): () => void;
  dispose(): Promise<void>;
};

/** Narrow sink for {@link dispatchTransportIntent}. */
export function transportAsMediaSink(transport: PlaybackTransport): {
  setTime: (timeSec: number) => void;
  play: () => Promise<void>;
  pause: () => void;
  isPlaying: () => boolean;
} {
  return {
    setTime: (timeSec) => {
      void transport.seek(timeSec);
    },
    play: () => transport.play(),
    pause: () => {
      void transport.pause();
    },
    isPlaying: () => transport.isPlaying(),
  };
}
