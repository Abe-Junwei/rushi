import { useCallback, useEffect, useRef, useState } from "react";
import { clampPxPerSec, TIMELINE_PX_PER_SEC } from "../utils/pxPerSec";
import { readStoredWaveformPxPerSec, writeStoredWaveformPxPerSec } from "../utils/waveformPrefs";

export function useWaveformZoom(args: {
  getTierWidth: () => number;
  getDuration: () => number;
  getSelectedSegment: () => { start_sec: number; end_sec: number } | null;
}) {
  const argsRef = useRef(args);
  argsRef.current = args;

  const [pxPerSec, setPxPerSecState] = useState(() => {
    const stored = readStoredWaveformPxPerSec();
    return stored != null ? stored : TIMELINE_PX_PER_SEC;
  });

  const skipInitialRef = useRef(true);
  useEffect(() => {
    if (skipInitialRef.current) {
      skipInitialRef.current = false;
      return;
    }
    writeStoredWaveformPxPerSec(pxPerSec);
  }, [pxPerSec]);

  const setPxPerSec = useCallback((next: number) => {
    setPxPerSecState(clampPxPerSec(next));
  }, []);

  const zoomIn = useCallback(() => {
    setPxPerSecState((p) => clampPxPerSec(p * 1.12));
  }, []);

  const zoomOut = useCallback(() => {
    setPxPerSecState((p) => clampPxPerSec(p / 1.12));
  }, []);

  const resetZoom = useCallback(() => {
    setPxPerSecState(TIMELINE_PX_PER_SEC);
  }, []);

  const zoomToFitTier = useCallback(() => {
    const a = argsRef.current;
    const w = a.getTierWidth();
    const dur = a.getDuration();
    if (w <= 0 || dur < 0.5) return;
    setPxPerSecState(clampPxPerSec(w / dur));
  }, []);

  const zoomToFitSelection = useCallback(() => {
    const a = argsRef.current;
    const w = a.getTierWidth();
    const dur = a.getDuration();
    const seg = a.getSelectedSegment();
    if (w <= 0 || dur < 0.5 || !seg) return;
    const span = Math.max(seg.end_sec - seg.start_sec, 0.05);
    const vw = Math.max(160, w - 24);
    setPxPerSecState(clampPxPerSec(vw / span));
  }, []);

  return { pxPerSec, setPxPerSec, zoomIn, zoomOut, resetZoom, zoomToFitTier, zoomToFitSelection };
}
