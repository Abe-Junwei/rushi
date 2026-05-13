import { useCallback, useEffect, useRef, useState } from "react";
import { clampP1PxPerSec, P1_TIMELINE_PX_PER_SEC } from "../utils/p1PxPerSec";
import { readStoredP1WaveformPxPerSec, writeStoredP1WaveformPxPerSec } from "../utils/p1WaveformPrefs";

export function useP1WaveformZoom(args: {
  getTierWidth: () => number;
  getDuration: () => number;
  getSelectedSegment: () => { start_sec: number; end_sec: number } | null;
}) {
  const argsRef = useRef(args);
  argsRef.current = args;

  const [pxPerSec, setPxPerSecState] = useState(() => {
    const stored = readStoredP1WaveformPxPerSec();
    return stored != null ? stored : P1_TIMELINE_PX_PER_SEC;
  });

  const skipInitialRef = useRef(true);
  useEffect(() => {
    if (skipInitialRef.current) {
      skipInitialRef.current = false;
      return;
    }
    writeStoredP1WaveformPxPerSec(pxPerSec);
  }, [pxPerSec]);

  const setPxPerSec = useCallback((next: number) => {
    setPxPerSecState(clampP1PxPerSec(next));
  }, []);

  const zoomIn = useCallback(() => {
    setPxPerSecState((p) => clampP1PxPerSec(p * 1.12));
  }, []);

  const zoomOut = useCallback(() => {
    setPxPerSecState((p) => clampP1PxPerSec(p / 1.12));
  }, []);

  const resetZoom = useCallback(() => {
    setPxPerSecState(P1_TIMELINE_PX_PER_SEC);
  }, []);

  const zoomToFitTier = useCallback(() => {
    const a = argsRef.current;
    const w = a.getTierWidth();
    const dur = a.getDuration();
    if (w <= 0 || dur < 0.5) return;
    setPxPerSecState(clampP1PxPerSec(w / dur));
  }, []);

  const zoomToFitSelection = useCallback(() => {
    const a = argsRef.current;
    const w = a.getTierWidth();
    const dur = a.getDuration();
    const seg = a.getSelectedSegment();
    if (w <= 0 || dur < 0.5 || !seg) return;
    const span = Math.max(seg.end_sec - seg.start_sec, 0.05);
    const vw = Math.max(160, w - 24);
    setPxPerSecState(clampP1PxPerSec(vw / span));
  }, []);

  return { pxPerSec, setPxPerSec, zoomIn, zoomOut, resetZoom, zoomToFitTier, zoomToFitSelection };
}
