import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MutableRefObject, type RefObject } from "react";
import type WaveSurfer from "wavesurfer.js";
import type { PeakCache } from "../services/waveform/PeakCache";
import {
  quantizePxPerSecForPeaksLoad,
  shouldZoomOnlyForSubMinFitAllRefit,
} from "../utils/pxPerSec";

const DECODE_SAMPLE_RATE = 8000;

type PendingPeaksLoad = {
  url: string;
  loadPeaksPx: number;
  layoutDur: number;
};

function disableWaveSurferAutoScroll(ws: WaveSurfer): void {
  try {
    ws.setOptions({ autoScroll: false });
  } catch {
    /* noop */
  }
}

/** Sync layout px/s → WaveSurfer zoom; ws.load(peaks) when cache ready / quantum changes. */
export function useWaveformZoomSync(args: {
  wsRef: RefObject<WaveSurfer | null>;
  isReady: boolean;
  isPlaying: boolean;
  hotSwitchWhilePlayingRef: MutableRefObject<boolean>;
  /** Bumps layout effect when user toggles the playing hot-switch pref. */
  hotSwitchWhilePlaying: boolean;
  disabled?: boolean;
  minPxPerSec: number;
  appliedZoomPxPerSecRef: MutableRefObject<number>;
  appliedPeaksRef?: MutableRefObject<boolean>;
  appliedPeaksLoadPxPerSecRef?: MutableRefObject<number>;
  peakCache?: PeakCache | null;
  peakCacheGeneration?: number;
  peakCacheRef?: RefObject<PeakCache | null>;
  layoutDurationSecRef?: MutableRefObject<number>;
  /** Bumps layout effect when timeline duration truth changes (decode → peaks). */
  layoutDurationSec?: number;
  mediaUrl?: string | null;
  onZoomAppliedRef?: MutableRefObject<((pxPerSec: number) => boolean | void) | undefined>;
  cancelInFlightZoomRef?: MutableRefObject<(() => void) | undefined>;
  /** While viewport resize transaction runs, defer ws.load until hold clears. */
  viewportResizeHoldRef?: MutableRefObject<boolean>;
  /** Register flush for deferred peaks load (called after viewport transaction). */
  flushDeferredPeaksLoadRef?: MutableRefObject<(() => void) | undefined>;
}) {
  const {
    wsRef,
    isReady,
    isPlaying,
    hotSwitchWhilePlayingRef,
    hotSwitchWhilePlaying,
    disabled,
    minPxPerSec,
    appliedZoomPxPerSecRef,
    appliedPeaksRef,
    appliedPeaksLoadPxPerSecRef,
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

  const zoomSyncInFlightRef = useRef<number | null>(null);
  const peaksLoadSeqRef = useRef(0);
  const peaksLoadInFlightPxRef = useRef<number | null>(null);
  const pendingPeaksHotSwitchRef = useRef(false);
  const pendingPeaksLoadRef = useRef<PendingPeaksLoad | null>(null);
  const prevMinPxPerSecRef = useRef(minPxPerSec);
  const prevPlayingRef = useRef(isPlaying);
  const [peaksHotSwitchPending, setPeaksHotSwitchPending] = useState(false);
  const [peaksApplied, setPeaksApplied] = useState(false);
  const [peaksHotSwitchRetry, setPeaksHotSwitchRetry] = useState(0);

  const syncPeaksHotSwitchPending = useCallback((pending: boolean) => {
    pendingPeaksHotSwitchRef.current = pending;
    setPeaksHotSwitchPending(pending);
  }, []);

  const markPeaksApplied = useCallback(
    (applied: boolean, loadPeaksPx: number) => {
      if (appliedPeaksRef) appliedPeaksRef.current = applied;
      if (appliedPeaksLoadPxPerSecRef) {
        appliedPeaksLoadPxPerSecRef.current = applied ? loadPeaksPx : Number.NaN;
      }
      setPeaksApplied(applied);
    },
    [appliedPeaksLoadPxPerSecRef, appliedPeaksRef],
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
      markPeaksApplied(false, Number.NaN);
      syncPeaksHotSwitchPending(false);
    }
  }, [markPeaksApplied, peakCache, syncPeaksHotSwitchPending]);

  useEffect(() => {
    prevMinPxPerSecRef.current = minPxPerSec;
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
      if (zoomSyncInFlightRef.current !== null && zoomSyncInFlightRef.current !== minPxPerSec) {
        return;
      }
      try {
        if (Math.abs(appliedZoomPxPerSecRef.current - minPxPerSec) > 1e-6) {
          currentWs.zoom(minPxPerSec);
        }
        appliedZoomPxPerSecRef.current = minPxPerSec;
        onZoomAppliedRef?.current?.(minPxPerSec);
      } catch {
        /* noop */
      } finally {
        if (zoomSyncInFlightRef.current === minPxPerSec) {
          zoomSyncInFlightRef.current = null;
        }
      }
    };

    const loadPeaksIntoWaveSurfer = (
      currentWs: WaveSurfer,
      cache: PeakCache,
      url: string,
      loadPeaksPx: number,
      layoutDur: number,
    ) => {
      if (peaksLoadInFlightPxRef.current === loadPeaksPx) return;
      peaksLoadInFlightPxRef.current = loadPeaksPx;

      const resumeTimeSec = currentWs.getCurrentTime();
      const resumePlaying = currentWs.isPlaying();

      const loadSeq = ++peaksLoadSeqRef.current;
      zoomSyncInFlightRef.current = minPxPerSec;
      syncPeaksHotSwitchPending(false);

      try {
        void cache
          .getWaveSurferPeaksAsync(loadPeaksPx, layoutDur)
          .then((bundle) => {
            if (peaksLoadSeqRef.current !== loadSeq) return;
            if (peaksLoadInFlightPxRef.current !== loadPeaksPx) return;
            return currentWs.load(url, bundle.peaks, bundle.duration).then(() => {
              if (peaksLoadSeqRef.current !== loadSeq) return;
              if (wsRef.current !== currentWs) return;
              if (mediaUrl !== url) return;
              try {
                const nowTimeSec = currentWs.getCurrentTime();
                if (Math.abs(nowTimeSec - resumeTimeSec) < 0.5) {
                  currentWs.setTime(resumeTimeSec);
                }
                if (resumePlaying) void currentWs.play();
              } catch {
                /* noop */
              }
              markPeaksApplied(true, loadPeaksPx);
              finishZoom(currentWs);
            });
          })
          .catch(() => {
            if (wsRef.current !== currentWs) return;
            markPeaksApplied(false, Number.NaN);
            finishZoom(currentWs);
          })
          .finally(() => {
            if (peaksLoadInFlightPxRef.current === loadPeaksPx) {
              peaksLoadInFlightPxRef.current = null;
            }
          });
      } catch {
        peaksLoadInFlightPxRef.current = null;
        syncPeaksHotSwitchPending(false);
        if (zoomSyncInFlightRef.current === minPxPerSec) {
          zoomSyncInFlightRef.current = null;
        }
      }
    };

    const flushDeferredPeaksLoad = () => {
      if (viewportResizeHoldRef?.current) return;
      const pending = pendingPeaksLoadRef.current;
      if (!pending) return;
      pendingPeaksLoadRef.current = null;
      const currentWs = wsRef.current;
      const cache = peakCacheRef?.current;
      if (!currentWs || !cache || mediaUrl !== pending.url) return;
      loadPeaksIntoWaveSurfer(
        currentWs,
        cache,
        pending.url,
        pending.loadPeaksPx,
        pending.layoutDur,
      );
    };

    if (flushDeferredPeaksLoadRef) {
      flushDeferredPeaksLoadRef.current = flushDeferredPeaksLoad;
    }

    const schedulePeaksLoad = (
      currentWs: WaveSurfer,
      cache: PeakCache,
      url: string,
      loadPeaksPx: number,
      layoutDur: number,
    ) => {
      if (viewportResizeHoldRef?.current) {
        pendingPeaksLoadRef.current = { url, loadPeaksPx, layoutDur };
        finishZoom(currentWs);
        prevMinPxPerSecRef.current = minPxPerSec;
        return;
      }
      loadPeaksIntoWaveSurfer(currentWs, cache, url, loadPeaksPx, layoutDur);
    };

    const applyZoom = () => {
      const currentWs = wsRef.current;
      if (!currentWs || !isReady || disabled) return;

      disableWaveSurferAutoScroll(currentWs);

      const cache = peakCacheRef?.current;
      const url = mediaUrl;
      const loadPeaksPx = quantizePxPerSecForPeaksLoad(minPxPerSec);
      const pxPerSecChanged = Math.abs(prevMinPxPerSecRef.current - minPxPerSec) > 1e-6;

      if (cache && url) {
        const layoutDur =
          layoutDurationSecRef?.current && layoutDurationSecRef.current > 0
            ? layoutDurationSecRef.current
            : currentWs.getDuration() || 0;
        const loadedPeaksPx = appliedPeaksLoadPxPerSecRef?.current ?? Number.NaN;
        const peaksLoadedIntoWaveSurfer = appliedPeaksRef?.current === true;

        if (
          shouldZoomOnlyForSubMinFitAllRefit({
            requestedPeaksPxPerSec: loadPeaksPx,
            loadedPeaksPxPerSec: loadedPeaksPx,
            peaksLoadedIntoWaveSurfer,
            pxPerSecChanged,
            peaksLoadInFlight: peaksLoadInFlightPxRef.current != null,
          })
        ) {
          syncPeaksHotSwitchPending(false);
          finishZoom(currentWs);
          prevMinPxPerSecRef.current = minPxPerSec;
          return;
        }

        const peaksAlreadyLoaded =
          peaksLoadedIntoWaveSurfer && loadedPeaksPx === loadPeaksPx;

        if (peaksAlreadyLoaded && appliedZoomPxPerSecRef.current === minPxPerSec) {
          syncPeaksHotSwitchPending(false);
          prevMinPxPerSecRef.current = minPxPerSec;
          return;
        }

        if (peaksAlreadyLoaded) {
          syncPeaksHotSwitchPending(false);
          finishZoom(currentWs);
          prevMinPxPerSecRef.current = minPxPerSec;
          return;
        }

        if (!hotSwitchWhilePlayingRef?.current && currentWs.isPlaying()) {
          syncPeaksHotSwitchPending(true);
          finishZoom(currentWs);
          prevMinPxPerSecRef.current = minPxPerSec;
          return;
        }

        schedulePeaksLoad(currentWs, cache, url, loadPeaksPx, layoutDur);
        prevMinPxPerSecRef.current = minPxPerSec;
        return;
      }

      syncPeaksHotSwitchPending(false);
      markPeaksApplied(false, Number.NaN);
      finishZoom(currentWs);
      prevMinPxPerSecRef.current = minPxPerSec;
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
    appliedPeaksLoadPxPerSecRef,
    appliedPeaksRef,
    appliedZoomPxPerSecRef,
    disabled,
    flushDeferredPeaksLoadRef,
    hotSwitchWhilePlaying,
    isReady,
    peaksHotSwitchRetry,
    layoutDurationSecRef,
    layoutDurationSec,
    markPeaksApplied,
    mediaUrl,
    minPxPerSec,
    onZoomAppliedRef,
    peakCache,
    peakCacheGeneration,
    peakCacheRef,
    syncPeaksHotSwitchPending,
    viewportResizeHoldRef,
    wsRef,
  ]);

  return { cancelInFlightZoom, peaksHotSwitchPending, peaksApplied };
}

export { DECODE_SAMPLE_RATE };
