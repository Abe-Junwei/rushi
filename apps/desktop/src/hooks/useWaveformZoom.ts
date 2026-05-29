import { useCallback, useEffect, useRef, useState } from "react";
import {
  clampPxPerSec,
  clampPxPerSecForFitSelection,
  resolveDefaultResetPxPerSec,
  TIMELINE_PX_PER_SEC,
} from "../utils/pxPerSec";
import { readStoredWaveformPxPerSec, writeStoredWaveformPxPerSec } from "../utils/waveformPrefs";

const PREF_WRITE_DEBOUNCE_MS = 180;

function clampStoredPxPerSec(value: number | null | undefined): number {
  return clampPxPerSec(value ?? TIMELINE_PX_PER_SEC);
}

export function useWaveformZoom() {
  const [pxPerSec, setPxPerSecState] = useState(() =>
    clampStoredPxPerSec(readStoredWaveformPxPerSec()),
  );
  const [committedPxPerSec, setCommittedPxPerSecState] = useState(() =>
    clampStoredPxPerSec(readStoredWaveformPxPerSec()),
  );
  const [zoomDragging, setZoomDragging] = useState(false);
  const zoomDraggingRef = useRef(false);
  const pxPerSecRef = useRef(pxPerSec);
  pxPerSecRef.current = pxPerSec;

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

  const applyClamped = useCallback((clamped: number) => {
    setPxPerSecState(clamped);
    if (!zoomDraggingRef.current) {
      setCommittedPxPerSecState(clamped);
    }
  }, []);

  const applyBoth = useCallback(
    (next: number) => {
      applyClamped(clampPxPerSec(next));
    },
    [applyClamped],
  );

  /** Programmatic clamp to manual/fit min–max (not slider-range-aware). */
  const setPxPerSec = useCallback((next: number) => {
    const clamped = clampPxPerSec(next);
    setPxPerSecState(clamped);
    if (!zoomDraggingRef.current) {
      setCommittedPxPerSecState(clamped);
    }
  }, []);

  /** Slider / +/- / keyboard: value already clamped to sliderRange — no second clampPxPerSec. */
  const setPxPerSecFromSlider = useCallback((next: number) => {
    if (!Number.isFinite(next)) return;
    setPxPerSecState(next);
    if (!zoomDraggingRef.current) {
      setCommittedPxPerSecState(next);
    }
  }, []);

  const beginZoomInteraction = useCallback(() => {
    zoomDraggingRef.current = true;
    setZoomDragging(true);
  }, []);

  const commitZoomInteraction = useCallback(() => {
    zoomDraggingRef.current = false;
    setZoomDragging(false);
    setCommittedPxPerSecState(pxPerSecRef.current);
  }, []);

  const resetZoom = useCallback(() => {
    applyBoth(TIMELINE_PX_PER_SEC);
  }, [applyBoth]);

  const resetZoomForMedia = useCallback(
    (viewportWidthPx: number, durationSec: number) => {
      applyClamped(resolveDefaultResetPxPerSec(viewportWidthPx, durationSec));
    },
    [applyClamped],
  );

  const setFitPxPerSec = useCallback(
    (next: number) => {
      applyClamped(clampPxPerSecForFitSelection(next));
    },
    [applyClamped],
  );

  return {
    /** Layout / hit-test px per second (preview during slider drag). */
    layoutPxPerSec: pxPerSec,
    /** Peaks resample + tile draw px per second (frozen until commit). */
    drawPxPerSec: committedPxPerSec,
    pxPerSec,
    committedPxPerSec,
    renderPxPerSec: pxPerSec,
    zoomPreviewActive: zoomDragging,
    zoomDragging,
    setPxPerSec,
    setPxPerSecFromSlider,
    resetZoom,
    resetZoomForMedia,
    setFitPxPerSec,
    beginZoomInteraction,
    commitZoomInteraction,
  };
}
