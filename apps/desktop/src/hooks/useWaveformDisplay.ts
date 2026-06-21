import { useCallback, useEffect, useRef, useState } from "react";
import {
  clampTranscriptFontPx,
  clampWaveformHeight,
  readStoredP1TranscriptFontPx,
  readStoredWaveformHeightPx,
  resolveStoredTranscriptFontPx,
  resolveStoredWaveformHeightPx,
  subscribeWaveformPrefs,
  TRANSCRIPT_FONT_DEFAULT,
  WAVEFORM_HEIGHT_DEFAULT,
  writeStoredP1TranscriptFontPx,
  writeStoredWaveformHeightPx,
} from "../utils/waveformPrefs";
import {
  clampSegmentLaneRowPx,
  computeSegmentLaneRowPx,
  transcriptFontPxFromDragDelta,
  transcriptFontPxFromSegmentRowPx,
} from "../utils/segmentLayout";
import { useDeferredRendererState } from "./useDeferredRendererState";

const PREF_WRITE_DEBOUNCE_MS = 180;
const TRANSCRIPT_RESIZE_DRAG_THRESHOLD_PX = 4;

const heightEquals = (a: number, b: number) => Math.abs(a - b) < 0.5;

export function useWaveformDisplay(args: { busy: boolean }) {
  const height = useDeferredRendererState({
    initial: readStoredWaveformHeightPx() ?? WAVEFORM_HEIGHT_DEFAULT,
    clamp: clampWaveformHeight,
    areEqual: heightEquals,
    trackCommitted: true,
    persist: {
      read: readStoredWaveformHeightPx,
      write: writeStoredWaveformHeightPx,
      debounceMs: PREF_WRITE_DEBOUNCE_MS,
    },
  });

  const [transcriptFontPx, setTranscriptFontPxState] = useState(
    () => readStoredP1TranscriptFontPx() ?? TRANSCRIPT_FONT_DEFAULT,
  );

  const transcriptFontPxRef = useRef(transcriptFontPx);
  transcriptFontPxRef.current = transcriptFontPx;

  const skipFontWriteRef = useRef(true);
  useEffect(() => {
    if (skipFontWriteRef.current) {
      skipFontWriteRef.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      writeStoredP1TranscriptFontPx(transcriptFontPx);
    }, PREF_WRITE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [transcriptFontPx]);

  useEffect(() => {
    return subscribeWaveformPrefs(() => {
      setTranscriptFontPxState(resolveStoredTranscriptFontPx());
      height.setVisual(resolveStoredWaveformHeightPx());
      height.flushRender();
    });
  }, [height]);

  const nudgeWaveformHeight = useCallback(
    (delta: number) => {
      height.setVisual((prev) => clampWaveformHeight(prev + delta));
      height.flushRender();
    },
    [height],
  );

  const markWaveformRenderHeightApplied = useCallback(
    (heightPx: number) => {
      height.markCommitted(heightPx);
    },
    [height],
  );

  const nudgeTranscriptFontPx = useCallback((delta: number) => {
    setTranscriptFontPxState((f) => clampTranscriptFontPx(f + delta));
  }, []);

  const setTranscriptFontPx = useCallback((px: number) => {
    setTranscriptFontPxState(clampTranscriptFontPx(px));
  }, []);

  const nudgeTranscriptRowHeightPx = useCallback((delta: number) => {
    const currentRow = computeSegmentLaneRowPx(transcriptFontPxRef.current);
    const nextRow = clampSegmentLaneRowPx(currentRow + delta);
    setTranscriptFontPxState(transcriptFontPxFromSegmentRowPx(nextRow));
  }, []);

  const beginWaveformHeightDrag = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0 || args.busy) return;
      e.preventDefault();
      const target = e.currentTarget;
      target.setPointerCapture(e.pointerId);
      height.setDragging(true);
      const startY = e.clientY;
      const startH = height.visual;
      const onMove = (ev: PointerEvent) => {
        height.setVisual(clampWaveformHeight(startH + (ev.clientY - startY)));
      };
      const onUp = (ev: PointerEvent) => {
        height.setDragging(false);
        height.flushRender();
        try {
          target.releasePointerCapture(ev.pointerId);
        } catch {
          /* noop */
        }
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [args.busy, height],
  );

  const beginTranscriptFontDrag = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0 || args.busy) return;
      e.preventDefault();
      const target = e.currentTarget;
      target.setPointerCapture(e.pointerId);
      const startY = e.clientY;
      const startF = transcriptFontPxRef.current;
      let dragging = false;
      const onMove = (ev: PointerEvent) => {
        if ((ev.buttons & 1) !== 1) return;
        const dy = ev.clientY - startY;
        if (!dragging && Math.abs(dy) < TRANSCRIPT_RESIZE_DRAG_THRESHOLD_PX) return;
        dragging = true;
        setTranscriptFontPxState(transcriptFontPxFromDragDelta(startF, dy));
      };
      const onUp = (ev: PointerEvent) => {
        try {
          target.releasePointerCapture(ev.pointerId);
        } catch {
          /* noop */
        }
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [args.busy],
  );

  const beginTranscriptRowHeightDrag = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0 || args.busy) return;
      e.preventDefault();
      const target = e.currentTarget;
      target.setPointerCapture(e.pointerId);
      const startY = e.clientY;
      const startF = transcriptFontPxRef.current;
      let dragging = false;
      const onMove = (ev: PointerEvent) => {
        if ((ev.buttons & 1) !== 1) return;
        const dy = ev.clientY - startY;
        if (!dragging && Math.abs(dy) < TRANSCRIPT_RESIZE_DRAG_THRESHOLD_PX) return;
        dragging = true;
        setTranscriptFontPxState(transcriptFontPxFromDragDelta(startF, dy));
      };
      const onUp = (ev: PointerEvent) => {
        try {
          target.releasePointerCapture(ev.pointerId);
        } catch {
          /* noop */
        }
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [args.busy],
  );

  const transcriptRowHeightPx = computeSegmentLaneRowPx(transcriptFontPx);

  return {
    waveformHeightPx: height.visual,
    waveformRenderHeightPx: height.render,
    waveformPaintedHeightPx: height.committed,
    waveformHeightDragging: height.dragging,
    transcriptFontPx,
    transcriptRowHeightPx,
    nudgeWaveformHeight,
    nudgeTranscriptFontPx,
    setTranscriptFontPx,
    nudgeTranscriptRowHeightPx,
    markWaveformRenderHeightApplied,
    beginWaveformHeightDrag,
    beginTranscriptFontDrag,
    beginTranscriptRowHeightDrag,
  };
}
