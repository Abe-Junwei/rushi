import { useCallback, useLayoutEffect, useRef, type MutableRefObject, type RefObject } from "react";
import type WaveSurfer from "wavesurfer.js";
import type { PeakCache } from "../services/waveform/PeakCache";
import { applyWaveSurferPeaksDrawMode } from "../services/waveform/waveSurferPeaksDraw";
import {
  clampWaveformScrollLeftPx,
  readVisibleWaveformScrollPx,
} from "../utils/waveformZoomScroll";

function disableWaveSurferAutoScroll(ws: WaveSurfer): void {
  try {
    ws.setOptions({ autoScroll: false });
  } catch {
    /* noop */
  }
}

export function useWaveformZoomSync(args: {
  wsRef: RefObject<WaveSurfer | null>;
  isReady: boolean;
  disabled?: boolean;
  minPxPerSec: number;
  appliedZoomPxPerSecRef: MutableRefObject<number>;
  appliedPeaksRef?: MutableRefObject<boolean>;
  peakCache?: PeakCache | null;
  peakCacheRef?: RefObject<PeakCache | null>;
  mediaUrl?: string | null;
  zoomDragging?: boolean;
  getViewportScrollPxRef?: MutableRefObject<(() => number) | undefined>;
  onZoomAppliedRef?: MutableRefObject<((pxPerSec: number) => boolean | void) | undefined>;
  cancelInFlightZoomRef?: MutableRefObject<(() => void) | undefined>;
}) {
  const {
    wsRef,
    isReady,
    disabled,
    minPxPerSec,
    appliedZoomPxPerSecRef,
    appliedPeaksRef,
    peakCache,
    peakCacheRef,
    mediaUrl,
    zoomDragging = false,
    getViewportScrollPxRef,
    onZoomAppliedRef,
    cancelInFlightZoomRef,
  } = args;

  const zoomSyncInFlightRef = useRef<number | null>(null);
  const peaksLoadSeqRef = useRef(0);

  const cancelInFlightZoom = useCallback(() => {
    peaksLoadSeqRef.current += 1;
    zoomSyncInFlightRef.current = null;
  }, []);

  if (cancelInFlightZoomRef) {
    cancelInFlightZoomRef.current = cancelInFlightZoom;
  }

  useLayoutEffect(() => {
    const ws = wsRef.current;
    if (!ws || !isReady || disabled) return;
    if (appliedZoomPxPerSecRef.current === minPxPerSec && zoomSyncInFlightRef.current !== minPxPerSec) {
      if (peakCacheRef?.current) {
        if (appliedPeaksRef?.current === true) return;
      } else {
        return;
      }
    }

    const captureScrollPx = (currentWs: WaveSurfer) =>
      readVisibleWaveformScrollPx(
        currentWs.getScroll(),
        getViewportScrollPxRef?.current?.(),
      );

    const resolveScrollRestorePx = (preservedScrollPx: number) => {
      const tierSl = getViewportScrollPxRef?.current?.();
      return tierSl != null ? tierSl : preservedScrollPx;
    };

    const restoreScrollPx = (currentWs: WaveSurfer, scrollPx: number) => {
      try {
        const target = clampWaveformScrollLeftPx({
          scrollLeftPx: scrollPx,
          pxPerSec: minPxPerSec,
          durationSec: currentWs.getDuration() || 0,
          viewportWidthPx: currentWs.getWidth() || 1,
        });
        currentWs.setScroll(target);
      } catch {
        /* noop */
      }
    };

    const finishDecodeFallbackZoom = (currentWs: WaveSurfer, options?: { skipZoom?: boolean }) => {
      requestAnimationFrame(() => {
        if (zoomSyncInFlightRef.current !== null && zoomSyncInFlightRef.current !== minPxPerSec) {
          return;
        }
        try {
          if (!options?.skipZoom) {
            currentWs.zoom(minPxPerSec);
          }
          appliedZoomPxPerSecRef.current = minPxPerSec;
          const fitApplied = onZoomAppliedRef?.current?.(minPxPerSec) === true;
          if (!fitApplied) {
            restoreScrollPx(currentWs, resolveScrollRestorePx(captureScrollPx(currentWs)));
          }
        } catch {
          /* noop */
        } finally {
          if (zoomSyncInFlightRef.current === minPxPerSec) {
            zoomSyncInFlightRef.current = null;
          }
        }
      });
    };

    const finishPeaksCanvasZoom = () => {
      requestAnimationFrame(() => {
        if (zoomSyncInFlightRef.current !== null && zoomSyncInFlightRef.current !== minPxPerSec) {
          return;
        }
        appliedZoomPxPerSecRef.current = minPxPerSec;
        onZoomAppliedRef?.current?.(minPxPerSec);
        if (zoomSyncInFlightRef.current === minPxPerSec) {
          zoomSyncInFlightRef.current = null;
        }
      });
    };

    const applyPeaksCanvasZoom = (currentWs: WaveSurfer) => {
      const cache = peakCacheRef?.current;
      if (!cache) return;
      zoomSyncInFlightRef.current = minPxPerSec;
      peaksLoadSeqRef.current += 1;
      try {
        cache.getWaveSurferPeaks(minPxPerSec);
      } catch {
        zoomSyncInFlightRef.current = null;
        return;
      }
      disableWaveSurferAutoScroll(currentWs);
      applyWaveSurferPeaksDrawMode(currentWs, true);
      if (appliedPeaksRef) appliedPeaksRef.current = true;
      finishPeaksCanvasZoom();
    };

    const applyZoom = () => {
      const currentWs = wsRef.current;
      if (!currentWs || !isReady || disabled) return;
      if (appliedZoomPxPerSecRef.current === minPxPerSec && zoomSyncInFlightRef.current !== minPxPerSec) {
        if (peakCacheRef?.current) {
          if (appliedPeaksRef?.current === true) return;
        } else {
          return;
        }
      }

      const cache = peakCacheRef?.current;
      if (cache) {
        applyPeaksCanvasZoom(currentWs);
        return;
      }

      if (appliedPeaksRef?.current) {
        appliedPeaksRef.current = false;
        applyWaveSurferPeaksDrawMode(currentWs, false);
      }
      finishDecodeFallbackZoom(currentWs);
    };

    if (zoomDragging) {
      return;
    }

    applyZoom();
    return () => {
      peaksLoadSeqRef.current += 1;
      zoomSyncInFlightRef.current = null;
    };
  }, [
    appliedZoomPxPerSecRef,
    appliedPeaksRef,
    disabled,
    isReady,
    mediaUrl,
    minPxPerSec,
    peakCache,
    peakCacheRef,
    wsRef,
    zoomDragging,
    getViewportScrollPxRef,
    onZoomAppliedRef,
  ]);

  return { cancelInFlightZoom };
}
