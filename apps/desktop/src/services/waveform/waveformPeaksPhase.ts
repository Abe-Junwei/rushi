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
  peakCache: unknown;
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
    return "decode";
  }
  if (input.waveformReady && !input.peaksApplied && !input.peaksHotSwitchPending) {
    const peaksStillLoading =
      input.peaksLoading || (input.peakCache != null && !input.peaksApplied);
    if (!peaksStillLoading) {
      return "peaks";
    }
  }
  if (input.peakCache && !input.peaksApplied) {
    return input.waveformReady ? "decode" : "generating";
  }
  if (input.peaksLoading && !input.peakCache) {
    return input.waveformReady ? "decode" : "generating";
  }
  return input.waveformReady ? "decode" : "generating";
}
