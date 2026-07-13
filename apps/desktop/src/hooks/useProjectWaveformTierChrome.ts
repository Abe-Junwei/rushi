import { useCallback, useRef } from "react";
import type WaveSurfer from "wavesurfer.js";
import { requestWaveformSegmentBandPaint } from "../utils/tierScrollFrameCoordinator";
import { syncWaveSurferScrollFromTier as applyWaveSurferTierScroll } from "../services/waveform/waveformSurferProgressCoverage";
import type { UseProjectWaveformOptions } from "./useProjectWaveformTypes";

/** Tier scroll → WS host scroll + band chrome frame requests. */
export function useProjectWaveformTierChrome(args: {
  wsRef: React.MutableRefObject<WaveSurfer | null>;
  tierScrollRef?: UseProjectWaveformOptions["tierScrollRef"];
  tierViewportMetricsRef?: UseProjectWaveformOptions["tierViewportMetricsRef"];
}) {
  const { wsRef, tierScrollRef, tierViewportMetricsRef } = args;

  const requestViewportChromeFrame = useCallback(() => {
    const ws = wsRef.current;
    if (!ws) return;
    try {
      requestWaveformSegmentBandPaint();
    } catch {
      /* noop */
    }
  }, [wsRef]);

  const getTierScrollLeftPxRef = useRef<() => number>(() => 0);
  getTierScrollLeftPxRef.current = () => {
    const tier = tierScrollRef?.current;
    if (tier) return tier.scrollLeft;
    const live = tierViewportMetricsRef?.current?.tierScrollLive.scrollLeftRef.current;
    if (typeof live === "number" && Number.isFinite(live)) return live;
    return 0;
  };

  const syncTierScrollAfterRenderRef = useRef<() => void>(() => {});
  syncTierScrollAfterRenderRef.current = () => {
    const ws = wsRef.current;
    if (ws) applyWaveSurferTierScroll(ws, getTierScrollLeftPxRef.current());
    requestViewportChromeFrame();
  };

  const syncWaveSurferScrollFromTier = useCallback(
    (scrollLeftPx: number) => {
      const ws = wsRef.current;
      if (!ws) return;
      applyWaveSurferTierScroll(ws, scrollLeftPx);
    },
    [wsRef],
  );

  return {
    requestViewportChromeFrame,
    getTierScrollLeftPxRef,
    syncTierScrollAfterRenderRef,
    syncWaveSurferScrollFromTier,
  };
}
