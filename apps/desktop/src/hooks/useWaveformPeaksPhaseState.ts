import { useMemo } from "react";
import { resolveWaveformPeaksPhase, type WaveformPeaksPhase } from "../services/waveform/waveformPeaksPhase";

export function useWaveformPeaksPhaseState(input: {
  mediaUrl: string | null | undefined;
  peaksLoading: boolean;
  peakCache: unknown;
  peaksUnavailable: boolean;
  peaksApplied: boolean;
  peaksHotSwitchPending: boolean;
  waveformReady: boolean;
  backgroundPeaksEnabled: boolean;
  mountDeferred: boolean;
}): WaveformPeaksPhase {
  return useMemo(
    () =>
      resolveWaveformPeaksPhase({
        mediaUrl: input.mediaUrl,
        peaksLoading: input.peaksLoading,
        peakCache: input.peakCache,
        peaksUnavailable: input.peaksUnavailable,
        peaksApplied: input.peaksApplied,
        peaksHotSwitchPending: input.peaksHotSwitchPending,
        waveformReady: input.waveformReady,
        backgroundPeaksEnabled: input.backgroundPeaksEnabled,
        mountDeferred: input.mountDeferred,
      }),
    [
      input.mediaUrl,
      input.peaksLoading,
      input.peakCache,
      input.peaksUnavailable,
      input.peaksApplied,
      input.peaksHotSwitchPending,
      input.waveformReady,
      input.backgroundPeaksEnabled,
      input.mountDeferred,
    ],
  );
}
