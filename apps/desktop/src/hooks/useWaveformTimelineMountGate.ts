import { useWaveformMountDeferTimeout } from "./useWaveformMountDeferTimeout";
import { resolveWaveformMountDeferred } from "../utils/waveformMountPolicy";
import { logRuntimeParity } from "../services/runtimeParity";
import {
  logWaveformRenderPath,
  resolveIntendedWaveformMountPath,
} from "../services/waveform/waveformRuntimePath";
import { useEffect } from "react";

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

  useEffect(() => {
    if (!input.mediaUrl) return;
    if (deferDecodeMount) {
      logRuntimeParity("waveform_mount", "defer=true waiting_for_peaks");
      return;
    }
    const { path, reason } = resolveIntendedWaveformMountPath({
      backgroundPeaksEnabled: input.backgroundPeaksEnabled,
      peakCache: input.peakCache,
      peaksUnavailable: input.peaksUnavailable,
      deferTimedOut: mountDeferTimedOut,
    });
    logWaveformRenderPath(path, reason, mountDeferTimedOut ? "after_defer_timeout" : undefined);
  }, [
    deferDecodeMount,
    input.mediaUrl,
    input.backgroundPeaksEnabled,
    input.peakCache,
    input.peaksUnavailable,
    mountDeferTimedOut,
  ]);

  return { deferDecodeMount, mountDeferTimedOut, deferRequested };
}
