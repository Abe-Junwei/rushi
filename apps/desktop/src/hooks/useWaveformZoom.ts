import { useCallback, useRef } from "react";
import {
  clampPxPerSec,
  clampPxPerSecForSlider,
  computeFitAllPxPerSec,
  computeFitSelectionPxPerSec,
  TIMELINE_PX_PER_SEC,
} from "../utils/pxPerSec";
import { readStoredWaveformPxPerSec, writeStoredWaveformPxPerSec } from "../utils/waveformPrefs";
import { useDeferredRendererState } from "./useDeferredRendererState";

const PREF_WRITE_DEBOUNCE_MS = 180;

const pxEquals = (a: number, b: number) => Math.abs(a - b) < 0.001;

export function useWaveformZoom(args: {
  getTierWidth: () => number;
  getDuration: () => number;
  getSelectedSegment: () => { start_sec: number; end_sec: number } | null;
}) {
  const argsRef = useRef(args);
  argsRef.current = args;

  const zoom = useDeferredRendererState({
    initial: readStoredWaveformPxPerSec() ?? TIMELINE_PX_PER_SEC,
    clamp: clampPxPerSec,
    areEqual: pxEquals,
    renderDelayMs: 0,
    persist: {
      read: readStoredWaveformPxPerSec,
      write: writeStoredWaveformPxPerSec,
      debounceMs: PREF_WRITE_DEBOUNCE_MS,
    },
  });

  const setPxPerSec = useCallback(
    (next: number) => {
      zoom.setVisual(clampPxPerSecForSlider(next));
    },
    [zoom],
  );

  const beginZoomInteraction = useCallback(() => {
    zoom.setDragging(true);
  }, [zoom]);

  const commitZoomInteraction = useCallback(() => {
    zoom.setDragging(false);
    zoom.flushRender();
  }, [zoom]);

  const zoomIn = useCallback(() => {
    zoom.setVisual((p) => clampPxPerSec(p * 1.12));
    zoom.flushRender();
  }, [zoom]);

  const zoomOut = useCallback(() => {
    zoom.setVisual((p) => clampPxPerSecForSlider(p / 1.12));
    zoom.flushRender();
  }, [zoom]);

  const resetZoom = useCallback(() => {
    zoom.setVisual(TIMELINE_PX_PER_SEC);
    zoom.flushRender();
  }, [zoom]);

  const zoomToFitTier = useCallback(() => {
    const a = argsRef.current;
    const w = a.getTierWidth();
    const dur = a.getDuration();
    if (w <= 0 || dur < 0.5) return;
    zoom.setVisual(computeFitAllPxPerSec(w, dur));
    zoom.flushRender();
  }, [zoom]);

  const zoomToFitSelection = useCallback(() => {
    const a = argsRef.current;
    const w = a.getTierWidth();
    const dur = a.getDuration();
    const seg = a.getSelectedSegment();
    if (w <= 0 || dur < 0.5 || !seg) return;
    zoom.setVisual(computeFitSelectionPxPerSec(w, seg.start_sec, seg.end_sec));
    zoom.flushRender();
  }, [zoom]);

  return {
    pxPerSec: zoom.visual,
    renderPxPerSec: zoom.render,
    zoomPreviewActive: zoom.previewActive,
    zoomDragging: zoom.dragging,
    setPxPerSec,
    zoomIn,
    zoomOut,
    resetZoom,
    zoomToFitTier,
    zoomToFitSelection,
    beginZoomInteraction,
    commitZoomInteraction,
  };
}
