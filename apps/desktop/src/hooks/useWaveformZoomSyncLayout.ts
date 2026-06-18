import { useLayoutEffect, type MutableRefObject, type RefObject } from "react";
import type WaveSurfer from "wavesurfer.js";
import type { PeakCache } from "../services/waveform/PeakCache";
import {
  clearPeaksAppliedForDecode,
  commitWaveSurferZoom,
  disableWaveSurferAutoScroll,
  loadPeaksIntoWaveSurfer,
  planWaveformZoomApply,
  type WaveformZoomSyncInFlight,
} from "../services/waveform/waveformZoomSyncEngine";
import {
  wfProfileBegin,
  wfProfileFlush,
  wfProfileSetLabel,
} from "../services/waveform/waveformZoomProfile";
import {
  isPeaksLoadedIntoWs,
  readLoadedPeaksPx,
  type WaveformAppliedZoomState,
} from "../utils/waveformAppliedZoom";

type PendingPeaksLoad = {
  url: string;
  loadPeaksPx: number;
  layoutDur: number;
};

function reconcilePeaksAppliedFromAppliedZoom(
  appliedZoom: WaveformAppliedZoomState,
  onPeaksApplied: (applied: boolean, loadPeaksPx: number) => void,
): void {
  if (isPeaksLoadedIntoWs(appliedZoom)) {
    onPeaksApplied(true, readLoadedPeaksPx(appliedZoom));
  }
}

export function useWaveformZoomSyncLayoutEffect(args: {
  wsRef: RefObject<WaveSurfer | null>;
  isReady: boolean;
  disabled?: boolean;
  layoutPxPerSec: number;
  drawPxPerSec: number;
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
  hotSwitchWhilePlayingRef: MutableRefObject<boolean>;
  hotSwitchWhilePlaying: boolean;
  inFlight: WaveformZoomSyncInFlight;
  pendingPeaksLoadRef: MutableRefObject<PendingPeaksLoad | null>;
  prevDrawPxPerSecRef: MutableRefObject<number>;
  peaksHotSwitchRetry: number;
  onPeaksApplied: (applied: boolean, loadPeaksPx: number, layoutDurSec?: number) => void;
  syncPeaksHotSwitchPending: (pending: boolean) => void;
}): void {
  const {
    wsRef,
    isReady,
    disabled,
    layoutPxPerSec,
    drawPxPerSec,
    appliedZoom,
    peakCache,
    peakCacheGeneration = 0,
    peakCacheRef,
    layoutDurationSecRef,
    layoutDurationSec = 0,
    mediaUrl,
    onZoomAppliedRef,
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
  } = args;

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
      finishZoom(currentWs);
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
      wfProfileBegin(`zoom@${drawPxPerSec.toFixed(0)}px/s`);
      finishZoom(currentWs);

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
        peaksLoadInFlight: inFlight.peaksLoadInFlightPxRef.current != null,
        viewportResizeHold: viewportResizeHoldRef?.current ?? false,
      });
      wfProfileSetLabel(`${action.type}@${drawPxPerSec.toFixed(0)}px/s`);

      switch (action.type) {
        case "noop":
          syncPeaksHotSwitchPending(false);
          reconcilePeaksAppliedFromAppliedZoom(appliedZoom, onPeaksApplied);
          wfProfileFlush();
          break;
        case "finish-zoom":
          syncPeaksHotSwitchPending(false);
          if (!cache || !mediaUrl) {
            clearPeaksAppliedForDecode(appliedZoom);
            onPeaksApplied(false, Number.NaN);
          } else {
            reconcilePeaksAppliedFromAppliedZoom(appliedZoom, onPeaksApplied);
          }
          wfProfileFlush();
          break;
        case "defer-hot-switch":
          syncPeaksHotSwitchPending(true);
          wfProfileFlush();
          break;
        case "defer-resize-load":
          pendingPeaksLoadRef.current = {
            url: mediaUrl!,
            loadPeaksPx: action.loadPeaksPx,
            layoutDur: action.layoutDur,
          };
          wfProfileFlush();
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
      inFlight.peaksLoadSeqRef.current += 1;
      inFlight.peaksLoadInFlightPxRef.current = null;
      inFlight.zoomSyncInFlightRef.current = null;
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
    inFlight,
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
    pendingPeaksLoadRef,
    prevDrawPxPerSecRef,
    syncPeaksHotSwitchPending,
    viewportResizeHoldRef,
    wsRef,
  ]);
}
