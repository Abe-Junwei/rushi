import { useCallback, useLayoutEffect, useRef, type MutableRefObject, type RefObject } from "react";
import type WaveSurfer from "wavesurfer.js";
import type { PeakCache } from "../services/waveform/PeakCache";
import { applyWaveSurferPeaksDrawMode } from "../services/waveform/waveSurferPeaksDraw";
import {
  clampWaveformScrollLeftPx,
  readVisibleWaveformScrollPx,
} from "../utils/waveformZoomScroll";

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

  const pendingRafRef = useRef(0);
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

    const finishZoom = (currentWs: WaveSurfer, preservedScrollPx: number, options?: { skipZoom?: boolean }) => {
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
          restoreScrollPx(currentWs, resolveScrollRestorePx(preservedScrollPx));
        }
      } catch {
        /* noop */
      } finally {
        if (zoomSyncInFlightRef.current === minPxPerSec) {
          zoomSyncInFlightRef.current = null;
        }
      }
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

      const preservedScrollPx = captureScrollPx(currentWs);
      const cache = peakCacheRef?.current;
      const url = mediaUrl;
      if (cache && url) {
        try {
          const bundle = cache.getWaveSurferPeaks(minPxPerSec);
          const loadSeq = ++peaksLoadSeqRef.current;
          zoomSyncInFlightRef.current = minPxPerSec;
          void currentWs
            .load(url, bundle.peaks, bundle.duration)
            .then(() => {
              if (peaksLoadSeqRef.current !== loadSeq) return;
              if (wsRef.current !== currentWs) return;
              if (mediaUrl !== url) return;
              applyWaveSurferPeaksDrawMode(currentWs, true);
              if (appliedPeaksRef) appliedPeaksRef.current = true;
              appliedZoomPxPerSecRef.current = minPxPerSec;
              finishZoom(currentWs, preservedScrollPx, { skipZoom: true });
            })
            .catch(() => {
              if (peaksLoadSeqRef.current !== loadSeq) return;
              if (wsRef.current !== currentWs) return;
              if (appliedPeaksRef) appliedPeaksRef.current = false;
              applyWaveSurferPeaksDrawMode(currentWs, false);
              finishZoom(currentWs, preservedScrollPx);
            });
          return;
        } catch {
          if (zoomSyncInFlightRef.current === minPxPerSec) {
            zoomSyncInFlightRef.current = null;
          }
          /* 回退 ws.zoom */
        }
      }

      // 回退到无 peaks 绘制时，确保 WS 颜色恢复可见
      if (appliedPeaksRef?.current) {
        appliedPeaksRef.current = false;
        applyWaveSurferPeaksDrawMode(currentWs, false);
      }
      finishZoom(currentWs, preservedScrollPx);
    };

    if (zoomDragging) {
      if (pendingRafRef.current) cancelAnimationFrame(pendingRafRef.current);
      pendingRafRef.current = requestAnimationFrame(() => {
        pendingRafRef.current = 0;
        applyZoom();
      });
      return () => {
        peaksLoadSeqRef.current += 1;
        zoomSyncInFlightRef.current = null;
        if (pendingRafRef.current) {
          cancelAnimationFrame(pendingRafRef.current);
          pendingRafRef.current = 0;
        }
      };
    }

    applyZoom();
    return () => {
      peaksLoadSeqRef.current += 1;
      zoomSyncInFlightRef.current = null;
    };
  }, [
    appliedZoomPxPerSecRef,
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
