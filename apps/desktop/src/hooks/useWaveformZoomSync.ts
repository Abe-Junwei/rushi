import { useEffect, type MutableRefObject, type RefObject } from "react";
import type WaveSurfer from "wavesurfer.js";

export function useWaveformZoomSync(args: {
  wsRef: RefObject<WaveSurfer | null>;
  isReady: boolean;
  disabled?: boolean;
  minPxPerSec: number;
  zoomRafRef: MutableRefObject<number>;
  appliedZoomPxPerSecRef: MutableRefObject<number>;
}) {
  const { wsRef, isReady, disabled, minPxPerSec, zoomRafRef, appliedZoomPxPerSecRef } = args;

  useEffect(() => {
    const ws = wsRef.current;
    if (!ws || !isReady || disabled) return;
    if (appliedZoomPxPerSecRef.current === minPxPerSec) return;
    if (zoomRafRef.current) cancelAnimationFrame(zoomRafRef.current);
    zoomRafRef.current = requestAnimationFrame(() => {
      zoomRafRef.current = 0;
      try {
        ws.zoom(minPxPerSec);
        appliedZoomPxPerSecRef.current = minPxPerSec;
      } catch {
        /* noop */
      }
    });
    return () => {
      if (zoomRafRef.current) {
        cancelAnimationFrame(zoomRafRef.current);
        zoomRafRef.current = 0;
      }
    };
  }, [appliedZoomPxPerSecRef, disabled, isReady, minPxPerSec, wsRef, zoomRafRef]);
}
