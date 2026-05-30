import { useCallback, useEffect, useRef, useState } from "react";
import {
  clampPxPerSec,
  clampPxPerSecForFitSelection,
  computeFitAllPxPerSec,
  resolveDefaultResetPxPerSec,
  TIMELINE_PX_PER_SEC,
  type WaveformZoomLayoutIntent,
} from "../utils/pxPerSec";
import { isPxPerSecNearFitAll, isNearEditingDefaultForMedia } from "../utils/waveformZoomBarState";
import { readStoredWaveformPxPerSec, writeStoredWaveformPxPerSec } from "../utils/waveformPrefs";

const PREF_WRITE_DEBOUNCE_MS = 180;
/** Peaks ws.load intent debounce while slider / step zoom is in flight. */
export const DRAW_PX_PER_SEC_DEBOUNCE_MS = 500;

function clampStoredPxPerSec(value: number | null | undefined): number {
  return clampPxPerSec(value ?? TIMELINE_PX_PER_SEC);
}

/**
 * Single zoom track for layout (timeline width, overlay, scroll).
 * `drawPxPerSec` debounces during interactive slider/step changes so ws.load
 * only runs after the user pauses — ws.zoom still follows layout immediately.
 */
export function useWaveformZoom() {
  const [layoutPxPerSec, setLayoutPxPerSecState] = useState(() =>
    clampStoredPxPerSec(readStoredWaveformPxPerSec()),
  );
  const [drawPxPerSec, setDrawPxPerSecState] = useState(() =>
    clampStoredPxPerSec(readStoredWaveformPxPerSec()),
  );
  const [layoutIntent, setLayoutIntent] = useState<WaveformZoomLayoutIntent>("manual");
  const layoutIntentRef = useRef<WaveformZoomLayoutIntent>("manual");
  layoutIntentRef.current = layoutIntent;

  const drawDebounceRef = useRef<number | null>(null);

  const setLayoutIntentState = useCallback((intent: WaveformZoomLayoutIntent) => {
    layoutIntentRef.current = intent;
    setLayoutIntent(intent);
  }, []);

  const flushDrawPxPerSec = useCallback((next: number) => {
    if (drawDebounceRef.current != null) {
      window.clearTimeout(drawDebounceRef.current);
      drawDebounceRef.current = null;
    }
    setDrawPxPerSecState(next);
  }, []);

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
    [],
  );

  const applyLayoutAndDraw = useCallback(
    (next: number) => {
      setLayoutPxPerSecState(next);
      flushDrawPxPerSec(next);
    },
    [flushDrawPxPerSec],
  );

  useEffect(() => {
    return () => {
      if (drawDebounceRef.current != null) {
        window.clearTimeout(drawDebounceRef.current);
      }
    };
  }, []);

  const skipPersistRef = useRef(true);
  useEffect(() => {
    if (skipPersistRef.current) {
      skipPersistRef.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      writeStoredWaveformPxPerSec(layoutPxPerSec);
    }, PREF_WRITE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [layoutPxPerSec]);

  const applyFitAllRefitPxPerSec = useCallback(
    (next: number) => {
      if (!Number.isFinite(next)) return;
      applyLayoutAndDraw(next);
    },
    [applyLayoutAndDraw],
  );

  const enterFitAllLayout = useCallback(
    (next: number) => {
      if (!Number.isFinite(next)) return;
      setLayoutIntentState("fit-all");
      applyLayoutAndDraw(next);
    },
    [applyLayoutAndDraw, setLayoutIntentState],
  );

  const setPxPerSec = useCallback(
    (next: number) => {
      setLayoutIntentState("manual");
      applyLayoutAndDraw(clampPxPerSec(next));
    },
    [applyLayoutAndDraw, setLayoutIntentState],
  );

  const setPxPerSecFromSlider = useCallback(
    (next: number) => {
      if (!Number.isFinite(next)) return;
      setLayoutIntentState("manual");
      setLayoutPxPerSecState(next);
      scheduleDrawPxPerSec(next);
    },
    [scheduleDrawPxPerSec, setLayoutIntentState],
  );

  const resetZoom = useCallback(() => {
    setLayoutIntentState("default");
    applyLayoutAndDraw(TIMELINE_PX_PER_SEC);
  }, [applyLayoutAndDraw, setLayoutIntentState]);

  const resetZoomForMedia = useCallback(
    (viewportWidthPx: number, durationSec: number) => {
      const px = resolveDefaultResetPxPerSec(viewportWidthPx, durationSec);
      let intent: WaveformZoomLayoutIntent = "manual";
      if (viewportWidthPx > 0 && durationSec >= 0.5) {
        const fitAll = computeFitAllPxPerSec(viewportWidthPx, durationSec);
        if (isPxPerSecNearFitAll(px, fitAll)) {
          intent = "fit-all";
        } else if (isNearEditingDefaultForMedia(px, viewportWidthPx, durationSec)) {
          intent = "default";
        }
      } else if (Math.abs(px - TIMELINE_PX_PER_SEC) < 1e-6) {
        intent = "default";
      }
      setLayoutIntentState(intent);
      applyLayoutAndDraw(px);
    },
    [applyLayoutAndDraw, setLayoutIntentState],
  );

  const setFitPxPerSec = useCallback(
    (next: number) => {
      setLayoutIntentState("fit-selection");
      applyLayoutAndDraw(clampPxPerSecForFitSelection(next));
    },
    [applyLayoutAndDraw, setLayoutIntentState],
  );

  return {
    /** Layout px/s — timeline width, overlay, scroll (live during interactive zoom). */
    layoutPxPerSec,
    /** Peaks-load px/s — debounced during slider/step zoom; drives ws.load quantum. */
    drawPxPerSec,
    /** Alias for layoutPxPerSec (existing call sites). */
    pxPerSec: layoutPxPerSec,
    layoutIntent,
    layoutIntentRef,
    setPxPerSec,
    setPxPerSecFromSlider,
    applyFitAllRefitPxPerSec,
    enterFitAllLayout,
    resetZoom,
    resetZoomForMedia,
    setFitPxPerSec,
  };
}
