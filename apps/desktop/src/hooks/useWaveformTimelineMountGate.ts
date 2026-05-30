import { useWaveformMountDeferTimeout } from "./useWaveformMountDeferTimeout";
import { resolveWaveformMountDeferred } from "../utils/waveformMountPolicy";

/** Defer / timeout policy for peaks-first WaveSurfer mount (extracted from timeline controller). */
export function useWaveformTimelineMountGate(input: {
  mediaUrl: string | null;
  mediaDurationSec: number;
  backgroundPeaksEnabled: boolean;
  peaksLoading: boolean;
  peakCache: unknown;
  peaksUnavailable: boolean;
}) {
  const deferRequested = resolveWaveformMountDeferred({
    backgroundPeaksEnabled: input.backgroundPeaksEnabled,
    peaksLoading: input.peaksLoading,
    peakCache: input.peakCache,
    peaksUnavailable: input.peaksUnavailable,
    mediaDurationSec: input.mediaDurationSec,
  });
  const mountDeferTimedOut = useWaveformMountDeferTimeout(
    input.mediaUrl,
    deferRequested,
    input.mediaDurationSec,
  );
  const deferDecodeMount = resolveWaveformMountDeferred({
    backgroundPeaksEnabled: input.backgroundPeaksEnabled,
    peaksLoading: input.peaksLoading,
    peakCache: input.peakCache,
    peaksUnavailable: input.peaksUnavailable,
    deferTimedOut: mountDeferTimedOut,
    mediaDurationSec: input.mediaDurationSec,
  });

  return { deferDecodeMount, mountDeferTimedOut, deferRequested };
}
