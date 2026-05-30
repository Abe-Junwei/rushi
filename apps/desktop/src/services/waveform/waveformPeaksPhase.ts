export type WaveformPeaksPhase =
  | "idle"
  | "generating"
  | "decode"
  | "peaks_pending"
  | "peaks"
  | "unavailable";

export function resolveWaveformPeaksPhase(input: {
  mediaUrl: string | null | undefined;
  peaksLoading: boolean;
  peakCache: unknown | null;
  peaksUnavailable: boolean;
  peaksApplied: boolean;
  peaksHotSwitchPending: boolean;
  waveformReady: boolean;
  backgroundPeaksEnabled?: boolean;
  mountDeferred?: boolean;
}): WaveformPeaksPhase {
  if (!input.mediaUrl) return "idle";
  if (input.peaksApplied) return "peaks";
  if (input.peaksUnavailable) return "unavailable";
  if (input.peaksHotSwitchPending) return "peaks_pending";
  if (input.mountDeferred && !input.waveformReady) {
    return "generating";
  }
  if (!input.waveformReady && !input.mountDeferred) {
    return "decode";
  }
  if (!input.backgroundPeaksEnabled) {
    return input.waveformReady ? "decode" : "decode";
  }
  if (input.peakCache && !input.peaksApplied) {
    return input.waveformReady ? "decode" : "generating";
  }
  if (input.peaksLoading && !input.peakCache) {
    return input.waveformReady ? "decode" : "generating";
  }
  return input.waveformReady ? "decode" : "generating";
}
