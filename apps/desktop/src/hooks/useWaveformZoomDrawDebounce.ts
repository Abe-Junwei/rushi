import { useCallback, useEffect, useRef } from "react";
import { DRAW_PX_PER_SEC_DEBOUNCE_MS } from "./useWaveformZoomConstants";

export function useWaveformZoomDrawDebounce(
  setDrawPxPerSecState: React.Dispatch<React.SetStateAction<number>>,
) {
  const drawDebounceRef = useRef<number | null>(null);

  const flushDrawPxPerSec = useCallback(
    (next: number) => {
      if (drawDebounceRef.current != null) {
        window.clearTimeout(drawDebounceRef.current);
        drawDebounceRef.current = null;
      }
      setDrawPxPerSecState(next);
    },
    [setDrawPxPerSecState],
  );

  const scheduleDrawPxPerSec = useCallback(
    (next: number) => {
      if (drawDebounceRef.current != null) {
        window.clearTimeout(drawDebounceRef.current);
      }
      drawDebounceRef.current = window.setTimeout(() => {
        drawDebounceRef.current = null;
        setDrawPxPerSecState(next);
      }, DRAW_PX_PER_SEC_DEBOUNCE_MS);
    },
    [setDrawPxPerSecState],
  );

  useEffect(() => {
    return () => {
      if (drawDebounceRef.current != null) {
        window.clearTimeout(drawDebounceRef.current);
      }
    };
  }, []);

  return { flushDrawPxPerSec, scheduleDrawPxPerSec };
}
