import { useCallback, useEffect, useRef, useState } from "react";
import {
  clampTranscriptFontPx,
  clampWaveformHeight,
  TRANSCRIPT_FONT_DEFAULT,
  WAVEFORM_HEIGHT_DEFAULT,
  readStoredP1TranscriptFontPx,
  readStoredWaveformHeightPx,
  writeStoredP1TranscriptFontPx,
  writeStoredWaveformHeightPx,
} from "../utils/waveformPrefs";

export function useWaveformDisplay(args: { busy: boolean }) {
  const [waveformHeightPx, setWaveformHeightPxState] = useState(
    () => readStoredWaveformHeightPx() ?? WAVEFORM_HEIGHT_DEFAULT,
  );
  const [transcriptFontPx, setTranscriptFontPxState] = useState(
    () => readStoredP1TranscriptFontPx() ?? TRANSCRIPT_FONT_DEFAULT,
  );

  const waveformHeightPxRef = useRef(waveformHeightPx);
  waveformHeightPxRef.current = waveformHeightPx;
  const transcriptFontPxRef = useRef(transcriptFontPx);
  transcriptFontPxRef.current = transcriptFontPx;

  const skipHWriteRef = useRef(true);
  useEffect(() => {
    if (skipHWriteRef.current) {
      skipHWriteRef.current = false;
      return;
    }
    writeStoredWaveformHeightPx(waveformHeightPx);
  }, [waveformHeightPx]);

  const skipFontWriteRef = useRef(true);
  useEffect(() => {
    if (skipFontWriteRef.current) {
      skipFontWriteRef.current = false;
      return;
    }
    writeStoredP1TranscriptFontPx(transcriptFontPx);
  }, [transcriptFontPx]);

  const nudgeWaveformHeight = useCallback((delta: number) => {
    setWaveformHeightPxState((h) => clampWaveformHeight(h + delta));
  }, []);

  const nudgeTranscriptFontPx = useCallback((delta: number) => {
    setTranscriptFontPxState((f) => clampTranscriptFontPx(f + delta));
  }, []);

  const beginWaveformHeightDrag = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0 || args.busy) return;
      e.preventDefault();
      const target = e.currentTarget;
      target.setPointerCapture(e.pointerId);
      const startY = e.clientY;
      const startH = waveformHeightPxRef.current;
      const onMove = (ev: PointerEvent) => {
        setWaveformHeightPxState(clampWaveformHeight(startH + (ev.clientY - startY)));
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

  const beginTranscriptFontDrag = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0 || args.busy) return;
      e.preventDefault();
      const target = e.currentTarget;
      target.setPointerCapture(e.pointerId);
      const startY = e.clientY;
      const startF = transcriptFontPxRef.current;
      const onMove = (ev: PointerEvent) => {
        setTranscriptFontPxState(clampTranscriptFontPx(startF + Math.round((ev.clientY - startY) / 5)));
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

  return {
    waveformHeightPx,
    transcriptFontPx,
    nudgeWaveformHeight,
    nudgeTranscriptFontPx,
    beginWaveformHeightDrag,
    beginTranscriptFontDrag,
  };
}
