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
  // WS-2b: peaksApplied can mean stub/media-only transport peaks, while the
  // visible canvas still needs PeakCache. Only treat as ready when cache exists.
  if (input.peaksApplied && input.peakCache != null) return "peaks";
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
  if (input.peakCache && !input.peaksApplied) {
    return input.waveformReady ? "decode" : "generating";
  }
  if (input.peaksLoading && !input.peakCache) {
    return input.waveformReady ? "decode" : "generating";
  }
  // Ready + no PeakCache yet (incl. long-media stub peaksApplied): keep loading tip.
  return input.waveformReady ? "decode" : "generating";
}
