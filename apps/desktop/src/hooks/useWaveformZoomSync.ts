import { useCallback, useEffect, useRef, useState, type MutableRefObject, type RefObject } from "react";
import type WaveSurfer from "wavesurfer.js";
import type { PeakCache } from "../services/waveform/PeakCache";
import type { WaveformZoomSyncInFlight } from "../services/waveform/waveformZoomSyncEngine";
import {
  isPeaksLoadedIntoWs,
  markAppliedPeaks,
  readLoadedPeaksPx,
  type WaveformAppliedZoomState,
} from "../utils/waveformAppliedZoom";
import { useWaveformZoomSyncLayoutEffect } from "./useWaveformZoomSyncLayout";

/** Sync layout px/s → WaveSurfer zoom; ws.load(peaks) when draw px/s cache ready / quantum changes. */
export function useWaveformZoomSync(args: {
  wsRef: RefObject<WaveSurfer | null>;
  isReady: boolean;
  isPlaying: boolean;
  hotSwitchWhilePlayingRef: MutableRefObject<boolean>;
  hotSwitchWhilePlaying: boolean;
  disabled?: boolean;
  /** Live layout px/s — ws.zoom follows immediately in layout effect. */
  layoutPxPerSec?: number;
  /** Peaks-load px/s — ws.load quantum follows this track (same as layout for discrete ±). */
  drawPxPerSec?: number;
  appliedZoom: WaveformAppliedZoomState;
  peakCache?: PeakCache | null;
  peakCacheGeneration?: number;
  peakCacheRef?: RefObject<PeakCache | null>;
  layoutDurationSecRef?: MutableRefObject<number>;
  layoutDurationSec?: number;
  mediaUrl?: string | null;
  onZoomAppliedRef?: MutableRefObject<((pxPerSec: number) => boolean | void) | undefined>;
  cancelInFlightZoomRef?: MutableRefObject<(() => void) | undefined>;
  viewportResizeHoldRef?: MutableRefObject<boolean>;
  flushDeferredPeaksLoadRef?: MutableRefObject<(() => void) | undefined>;
}) {
  const {
    wsRef,
    isReady,
    isPlaying,
    hotSwitchWhilePlayingRef,
    hotSwitchWhilePlaying,
    disabled,
    layoutPxPerSec: layoutPxPerSecArg,
    drawPxPerSec: drawPxPerSecArg,
    appliedZoom,
    peakCache,
    peakCacheGeneration = 0,
    peakCacheRef,
    layoutDurationSecRef,
    layoutDurationSec = 0,
    mediaUrl,
    onZoomAppliedRef,
    cancelInFlightZoomRef,
    viewportResizeHoldRef,
    flushDeferredPeaksLoadRef,
  } = args;

  const layoutPxPerSec = layoutPxPerSecArg ?? 56;
  const drawPxPerSec = drawPxPerSecArg ?? layoutPxPerSec;

  const zoomSyncInFlightRef = useRef<number | null>(null);
  const peaksLoadSeqRef = useRef(0);
  const peaksLoadInFlightPxRef = useRef<number | null>(null);
  const inFlightRef = useRef<WaveformZoomSyncInFlight | null>(null);
  if (!inFlightRef.current) {
    inFlightRef.current = {
      zoomSyncInFlightRef,
      peaksLoadSeqRef,
      peaksLoadInFlightPxRef,
    };
  }
  const inFlight = inFlightRef.current;

  const pendingPeaksHotSwitchRef = useRef(false);
  const pendingPeaksLoadRef = useRef<{ url: string; loadPeaksPx: number; layoutDur: number } | null>(null);
  const prevDrawPxPerSecRef = useRef(drawPxPerSec);
  const prevPlayingRef = useRef(isPlaying);
  const [peaksHotSwitchPending, setPeaksHotSwitchPending] = useState(false);
  const [peaksApplied, setPeaksApplied] = useState(false);
  const [peaksHotSwitchRetry, setPeaksHotSwitchRetry] = useState(0);

  const syncPeaksHotSwitchPending = useCallback((pending: boolean) => {
    pendingPeaksHotSwitchRef.current = pending;
    setPeaksHotSwitchPending(pending);
  }, []);

  const onPeaksApplied = useCallback(
    (applied: boolean, loadPeaksPx: number, layoutDurSec = 0) => {
      markAppliedPeaks(appliedZoom, applied, loadPeaksPx, layoutDurSec);
      setPeaksApplied(applied);
    },
    [appliedZoom],
  );

  useEffect(() => {
    const wasPlaying = prevPlayingRef.current;
    prevPlayingRef.current = isPlaying;
    if (wasPlaying && !isPlaying && pendingPeaksHotSwitchRef.current) {
      setPeaksHotSwitchRetry((n) => n + 1);
    }
  }, [isPlaying]);

  useEffect(() => {
    if (!peakCache) {
      onPeaksApplied(false, Number.NaN);
      syncPeaksHotSwitchPending(false);
    }
  }, [onPeaksApplied, peakCache, syncPeaksHotSwitchPending]);

  // WS-2b: zoom sync stays disabled (no ws.zoom / ws.load). Mark stub/media-only
  // peaksApplied only when PeakCache is present — otherwise phase UI treats
  // transport-ready as "波形就绪" and hides long-audio loading tips.
  useEffect(() => {
    if (!disabled || !isReady || !peakCache) return;
    if (isPeaksLoadedIntoWs(appliedZoom)) {
      onPeaksApplied(true, readLoadedPeaksPx(appliedZoom));
    }
  }, [appliedZoom, disabled, isReady, onPeaksApplied, peakCache, peakCacheGeneration]);

  useEffect(() => {
    prevDrawPxPerSecRef.current = drawPxPerSec;
  }, [drawPxPerSec, mediaUrl]);

  const cancelInFlightZoom = useCallback(() => {
    peaksLoadSeqRef.current += 1;
    zoomSyncInFlightRef.current = null;
    pendingPeaksLoadRef.current = null;
  }, []);

  if (cancelInFlightZoomRef) {
    cancelInFlightZoomRef.current = cancelInFlightZoom;
  }

  useWaveformZoomSyncLayoutEffect({
    wsRef,
    isReady,
    disabled,
    layoutPxPerSec,
    drawPxPerSec,
    appliedZoom,
    peakCache,
    peakCacheGeneration,
    peakCacheRef,
    layoutDurationSecRef,
    layoutDurationSec,
    mediaUrl,
    onZoomAppliedRef,
    cancelInFlightZoomRef,
    viewportResizeHoldRef,
    flushDeferredPeaksLoadRef,
    hotSwitchWhilePlayingRef,
    hotSwitchWhilePlaying,
    inFlight,
    pendingPeaksLoadRef,
    prevDrawPxPerSecRef,
    peaksHotSwitchRetry,
    onPeaksApplied,
    syncPeaksHotSwitchPending,
  });

  return { cancelInFlightZoom, peaksHotSwitchPending, peaksApplied };
}
