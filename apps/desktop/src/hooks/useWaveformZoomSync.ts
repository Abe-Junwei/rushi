import { useLayoutEffect, useRef, type MutableRefObject, type RefObject } from "react";
import type WaveSurfer from "wavesurfer.js";
import type { PeakCache } from "../services/waveform/PeakCache";
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
  peakCacheRef?: RefObject<PeakCache | null>;
  mediaUrl?: string | null;
  zoomDragging?: boolean;
  getViewportScrollPxRef?: MutableRefObject<(() => number) | undefined>;
  onZoomAppliedRef?: MutableRefObject<((pxPerSec: number) => boolean | void) | undefined>;
}) {
  const {
    wsRef,
    isReady,
    disabled,
    minPxPerSec,
    appliedZoomPxPerSecRef,
    peakCacheRef,
    mediaUrl,
    zoomDragging = false,
    getViewportScrollPxRef,
    onZoomAppliedRef,
  } = args;

  const pendingRafRef = useRef(0);

  useLayoutEffect(() => {
    const ws = wsRef.current;
    if (!ws || !isReady || disabled) return;
    if (appliedZoomPxPerSecRef.current === minPxPerSec) return;

    const captureScrollPx = (currentWs: WaveSurfer) =>
      readVisibleWaveformScrollPx(
        currentWs.getScroll(),
        getViewportScrollPxRef?.current?.(),
      );

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

    const finishZoom = (currentWs: WaveSurfer, preservedScrollPx: number) => {
      try {
        currentWs.zoom(minPxPerSec);
        appliedZoomPxPerSecRef.current = minPxPerSec;
        const fitApplied = onZoomAppliedRef?.current?.(minPxPerSec) === true;
        if (!fitApplied) {
          restoreScrollPx(currentWs, preservedScrollPx);
        }
      } catch {
        /* noop */
      }
    };

    const applyZoom = () => {
      const currentWs = wsRef.current;
      if (!currentWs || !isReady || disabled) return;
      if (appliedZoomPxPerSecRef.current === minPxPerSec) return;

      const preservedScrollPx = captureScrollPx(currentWs);
      const cache = peakCacheRef?.current;
      if (cache && mediaUrl) {
        try {
          const bundle = cache.getWaveSurferPeaks(minPxPerSec);
          appliedZoomPxPerSecRef.current = minPxPerSec;
          void currentWs
            .load(mediaUrl, bundle.peaks, bundle.duration)
            .then(() => {
              finishZoom(currentWs, preservedScrollPx);
            })
            .catch(() => {
              finishZoom(currentWs, preservedScrollPx);
            });
          return;
        } catch {
          /* 回退 ws.zoom */
        }
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
        if (pendingRafRef.current) {
          cancelAnimationFrame(pendingRafRef.current);
          pendingRafRef.current = 0;
        }
      };
    }

    applyZoom();
    return undefined;
  }, [
    appliedZoomPxPerSecRef,
    disabled,
    isReady,
    mediaUrl,
    minPxPerSec,
    peakCacheRef,
    wsRef,
    zoomDragging,
    getViewportScrollPxRef,
    onZoomAppliedRef,
  ]);
}
