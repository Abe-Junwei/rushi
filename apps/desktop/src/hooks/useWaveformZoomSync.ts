import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MutableRefObject, type RefObject } from "react";
import type WaveSurfer from "wavesurfer.js";
import type { PeakCache } from "../services/waveform/PeakCache";
import {
  clearPeaksAppliedForDecode,
  commitWaveSurferZoom,
  disableWaveSurferAutoScroll,
  loadPeaksIntoWaveSurfer,
  planWaveformZoomApply,
  WAVEFORM_DECODE_SAMPLE_RATE,
  type WaveformZoomSyncInFlight,
} from "../services/waveform/waveformZoomSyncEngine";
import {
  createWaveformAppliedZoomState,
  isPeaksLoadedIntoWs,
  markAppliedPeaks,
  readLoadedPeaksPx,
  type WaveformAppliedZoomState,
} from "../utils/waveformAppliedZoom";

export { WAVEFORM_DECODE_SAMPLE_RATE as DECODE_SAMPLE_RATE };

function reconcilePeaksAppliedFromAppliedZoom(
  appliedZoom: WaveformAppliedZoomState,
  onPeaksApplied: (applied: boolean, loadPeaksPx: number) => void,
): void {
  if (isPeaksLoadedIntoWs(appliedZoom)) {
    onPeaksApplied(true, readLoadedPeaksPx(appliedZoom));
  }
}

type PendingPeaksLoad = {
  url: string;
  loadPeaksPx: number;
  layoutDur: number;
};

/** Sync layout px/s → WaveSurfer zoom; ws.load(peaks) when draw px/s cache ready / quantum changes. */
export function useWaveformZoomSync(args: {
  wsRef: RefObject<WaveSurfer | null>;
  isReady: boolean;
  isPlaying: boolean;
  hotSwitchWhilePlayingRef: MutableRefObject<boolean>;
  hotSwitchWhilePlaying: boolean;
  disabled?: boolean;
  /** Live layout px/s — ws.zoom follows immediately. */
  layoutPxPerSec?: number;
  /** Debounced peaks-load px/s — ws.load quantum follows this track. */
  drawPxPerSec?: number;
  /** @deprecated Use layoutPxPerSec + drawPxPerSec. When set alone, applies to both tracks. */
  minPxPerSec?: number;
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
    minPxPerSec: minPxPerSecArg,
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

  const layoutPxPerSec = layoutPxPerSecArg ?? minPxPerSecArg ?? 56;
  const drawPxPerSec = drawPxPerSecArg ?? layoutPxPerSec;

  const zoomSyncInFlightRef = useRef<number | null>(null);
  const peaksLoadSeqRef = useRef(0);
  const peaksLoadInFlightPxRef = useRef<number | null>(null);
  const inFlight: WaveformZoomSyncInFlight = {
    zoomSyncInFlightRef,
    peaksLoadSeqRef,
    peaksLoadInFlightPxRef,
  };

  const pendingPeaksHotSwitchRef = useRef(false);
  const pendingPeaksLoadRef = useRef<PendingPeaksLoad | null>(null);
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
    (applied: boolean, loadPeaksPx: number) => {
      markAppliedPeaks(appliedZoom, applied, loadPeaksPx);
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

  useEffect(() => {
    prevDrawPxPerSecRef.current = drawPxPerSec;
  }, [mediaUrl]);

  const cancelInFlightZoom = useCallback(() => {
    peaksLoadSeqRef.current += 1;
    zoomSyncInFlightRef.current = null;
    pendingPeaksLoadRef.current = null;
  }, []);

  if (cancelInFlightZoomRef) {
    cancelInFlightZoomRef.current = cancelInFlightZoom;
  }

  useLayoutEffect(() => {
    const ws = wsRef.current;
    if (!ws || !isReady || disabled) return;

    const finishZoom = (currentWs: WaveSurfer) => {
      commitWaveSurferZoom({
        ws: currentWs,
        intentPxPerSec: layoutPxPerSec,
        appliedZoom,
        inFlight,
        onZoomApplied: onZoomAppliedRef?.current ?? undefined,
      });
    };

    const flushDeferredPeaksLoad = () => {
      if (viewportResizeHoldRef?.current) return;
      const pending = pendingPeaksLoadRef.current;
      if (!pending) return;
      pendingPeaksLoadRef.current = null;
      const currentWs = wsRef.current;
      const cache = peakCacheRef?.current;
      if (!currentWs || !cache || mediaUrl !== pending.url) return;
      syncPeaksHotSwitchPending(false);
      loadPeaksIntoWaveSurfer({
        ws: currentWs,
        cache,
        url: pending.url,
        loadPeaksPx: pending.loadPeaksPx,
        layoutDur: pending.layoutDur,
        intentPxPerSec: drawPxPerSec,
        mediaUrl,
        wsRef,
        appliedZoom,
        inFlight,
        onZoomApplied: onZoomAppliedRef?.current ?? undefined,
        onPeaksApplied,
      });
    };

    if (flushDeferredPeaksLoadRef) {
      flushDeferredPeaksLoadRef.current = flushDeferredPeaksLoad;
    }

    const applyZoom = () => {
      const currentWs = wsRef.current;
      if (!currentWs || !isReady || disabled) return;

      disableWaveSurferAutoScroll(currentWs);

      const cache = peakCacheRef?.current ?? peakCache ?? null;
      const action = planWaveformZoomApply({
        intentPxPerSec: drawPxPerSec,
        appliedZoom,
        peakCache: cache,
        mediaUrl,
        layoutDurationSecRef: layoutDurationSecRef?.current,
        layoutDurationSec,
        peakCacheDurationSec: cache?.durationSec,
        isPlaying: currentWs.isPlaying(),
        hotSwitchWhilePlaying: hotSwitchWhilePlayingRef?.current ?? hotSwitchWhilePlaying,
        peaksLoadInFlight: peaksLoadInFlightPxRef.current != null,
        viewportResizeHold: viewportResizeHoldRef?.current ?? false,
      });

      switch (action.type) {
        case "noop":
          syncPeaksHotSwitchPending(false);
          finishZoom(currentWs);
          reconcilePeaksAppliedFromAppliedZoom(appliedZoom, onPeaksApplied);
          break;
        case "finish-zoom":
          syncPeaksHotSwitchPending(false);
          if (!cache || !mediaUrl) {
            clearPeaksAppliedForDecode(appliedZoom);
            onPeaksApplied(false, Number.NaN);
          } else {
            reconcilePeaksAppliedFromAppliedZoom(appliedZoom, onPeaksApplied);
          }
          finishZoom(currentWs);
          break;
        case "defer-hot-switch":
          syncPeaksHotSwitchPending(true);
          finishZoom(currentWs);
          break;
        case "defer-resize-load":
          pendingPeaksLoadRef.current = {
            url: mediaUrl!,
            loadPeaksPx: action.loadPeaksPx,
            layoutDur: action.layoutDur,
          };
          finishZoom(currentWs);
          break;
        case "load-peaks":
          syncPeaksHotSwitchPending(false);
          loadPeaksIntoWaveSurfer({
            ws: currentWs,
            cache: cache!,
            url: mediaUrl!,
            loadPeaksPx: action.loadPeaksPx,
            layoutDur: action.layoutDur,
            intentPxPerSec: drawPxPerSec,
            mediaUrl,
            wsRef,
            appliedZoom,
            inFlight,
            onZoomApplied: onZoomAppliedRef?.current ?? undefined,
            onPeaksApplied,
          });
          break;
      }

      prevDrawPxPerSecRef.current = drawPxPerSec;
    };

    applyZoom();

    return () => {
      peaksLoadSeqRef.current += 1;
      peaksLoadInFlightPxRef.current = null;
      zoomSyncInFlightRef.current = null;
      if (flushDeferredPeaksLoadRef) {
        flushDeferredPeaksLoadRef.current = undefined;
      }
    };
  }, [
    appliedZoom,
    disabled,
    flushDeferredPeaksLoadRef,
    hotSwitchWhilePlaying,
    hotSwitchWhilePlayingRef,
    isReady,
    layoutDurationSec,
    layoutDurationSecRef,
    mediaUrl,
    layoutPxPerSec,
    drawPxPerSec,
    onPeaksApplied,
    onZoomAppliedRef,
    peakCache,
    peakCacheGeneration,
    peakCacheRef,
    peaksHotSwitchRetry,
    syncPeaksHotSwitchPending,
    viewportResizeHoldRef,
    wsRef,
  ]);

  return { cancelInFlightZoom, peaksHotSwitchPending, peaksApplied };
}

export { createWaveformAppliedZoomState };
