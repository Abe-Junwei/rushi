import { useCallback, useEffect, useRef, useState } from "react";
import {
  clampPxPerSec,
  clampPxPerSecForSlider,
  TIMELINE_PX_PER_SEC,
} from "../utils/pxPerSec";
import { readStoredWaveformPxPerSec, writeStoredWaveformPxPerSec } from "../utils/waveformPrefs";

const PREF_WRITE_DEBOUNCE_MS = 180;

export function useWaveformZoom() {
  const [pxPerSec, setPxPerSecState] = useState(() => {
    const stored = readStoredWaveformPxPerSec();
    return clampPxPerSec(stored ?? TIMELINE_PX_PER_SEC);
  });
  const [zoomDragging, setZoomDragging] = useState(false);

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

  const setPxPerSec = useCallback((next: number) => {
    setPxPerSecState(clampPxPerSecForSlider(next));
  }, []);

  const beginZoomInteraction = useCallback(() => {
    setZoomDragging(true);
  }, []);

  const commitZoomInteraction = useCallback(() => {
    setZoomDragging(false);
  }, []);

  const zoomIn = useCallback(() => {
    setPxPerSecState((p) => clampPxPerSec(p * 1.12));
  }, []);

  const zoomOut = useCallback(() => {
    setPxPerSecState((p) => clampPxPerSecForSlider(p / 1.12));
  }, []);

  const resetZoom = useCallback(() => {
    setPxPerSecState(clampPxPerSec(TIMELINE_PX_PER_SEC));
  }, []);

  const setFitPxPerSec = useCallback((next: number) => {
    setPxPerSecState(clampPxPerSec(next));
  }, []);

  return {
    pxPerSec,
    renderPxPerSec: pxPerSec,
    zoomPreviewActive: false,
    zoomDragging,
    setPxPerSec,
    zoomIn,
    zoomOut,
    resetZoom,
    setFitPxPerSec,
    beginZoomInteraction,
    commitZoomInteraction,
  };
}
