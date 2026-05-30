import { useCallback, useEffect, useRef, useState } from "react";
import {
  clampPxPerSec,
  clampPxPerSecForFitSelection,
  computeFitAllPxPerSec,
  resolveDefaultResetPxPerSec,
  TIMELINE_PX_PER_SEC,
  type WaveformZoomLayoutIntent,
} from "../utils/pxPerSec";
import { isPxPerSecNearFitAll } from "../utils/waveformZoomBarState";
import { readStoredWaveformPxPerSec, writeStoredWaveformPxPerSec } from "../utils/waveformPrefs";

const PREF_WRITE_DEBOUNCE_MS = 180;

function clampStoredPxPerSec(value: number | null | undefined): number {
  return clampPxPerSec(value ?? TIMELINE_PX_PER_SEC);
}

/** Single px/s track — WaveSurfer owns redraw on zoom / peaks reload. */
export function useWaveformZoom() {
  const [pxPerSec, setPxPerSecState] = useState(() =>
    clampStoredPxPerSec(readStoredWaveformPxPerSec()),
  );
  const [layoutIntent, setLayoutIntent] = useState<WaveformZoomLayoutIntent>("manual");
  const layoutIntentRef = useRef<WaveformZoomLayoutIntent>("manual");
  layoutIntentRef.current = layoutIntent;

  const setLayoutIntentState = useCallback((intent: WaveformZoomLayoutIntent) => {
    layoutIntentRef.current = intent;
    setLayoutIntent(intent);
  }, []);

  const skipPersistRef = useRef(true);
  useEffect(() => {
    if (skipPersistRef.current) {
      skipPersistRef.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      writeStoredWaveformPxPerSec(pxPerSec);
    }, PREF_WRITE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [pxPerSec]);

  const applyFitAllRefitPxPerSec = useCallback((next: number) => {
    if (!Number.isFinite(next)) return;
    setPxPerSecState(next);
  }, []);

  const enterFitAllLayout = useCallback(
    (next: number) => {
      if (!Number.isFinite(next)) return;
      setLayoutIntentState("fit-all");
      setPxPerSecState(next);
    },
    [setLayoutIntentState],
  );

  const setPxPerSec = useCallback(
    (next: number) => {
      setLayoutIntentState("manual");
      setPxPerSecState(clampPxPerSec(next));
    },
    [setLayoutIntentState],
  );

  const setPxPerSecFromSlider = useCallback(
    (next: number) => {
      if (!Number.isFinite(next)) return;
      setLayoutIntentState("manual");
      setPxPerSecState(next);
    },
    [setLayoutIntentState],
  );

  const resetZoom = useCallback(() => {
    setLayoutIntentState("default");
    setPxPerSecState(TIMELINE_PX_PER_SEC);
  }, [setLayoutIntentState]);

  const resetZoomForMedia = useCallback(
    (viewportWidthPx: number, durationSec: number) => {
      const px = resolveDefaultResetPxPerSec(viewportWidthPx, durationSec);
      let intent: WaveformZoomLayoutIntent = "manual";
      if (viewportWidthPx > 0 && durationSec >= 0.5) {
        const fitAll = computeFitAllPxPerSec(viewportWidthPx, durationSec);
        if (isPxPerSecNearFitAll(px, fitAll)) {
          intent = "fit-all";
        } else if (Math.abs(px - TIMELINE_PX_PER_SEC) < 1e-6) {
          intent = "default";
        }
      } else if (Math.abs(px - TIMELINE_PX_PER_SEC) < 1e-6) {
        intent = "default";
      }
      setLayoutIntentState(intent);
      setPxPerSecState(px);
    },
    [setLayoutIntentState],
  );

  const setFitPxPerSec = useCallback(
    (next: number) => {
      setLayoutIntentState("fit-selection");
      setPxPerSecState(clampPxPerSecForFitSelection(next));
    },
    [setLayoutIntentState],
  );

  return {
    pxPerSec,
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
};
