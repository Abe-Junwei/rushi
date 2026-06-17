import { useCallback, useEffect, useRef, useState } from "react";
import {
  clampPxPerSec,
  TIMELINE_PX_PER_SEC,
  type WaveformZoomLayoutIntent,
} from "../utils/pxPerSec";
import { readStoredWaveformPxPerSec, writeStoredWaveformPxPerSec } from "../utils/waveformPrefs";
import { PREF_WRITE_DEBOUNCE_MS } from "./useWaveformZoomConstants";
import { useWaveformZoomCommands } from "./useWaveformZoomCommands";
import { useWaveformZoomDrawDebounce } from "./useWaveformZoomDrawDebounce";

export { DRAW_PX_PER_SEC_DEBOUNCE_MS } from "./useWaveformZoomConstants";

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

  const { flushDrawPxPerSec, scheduleDrawPxPerSec } = useWaveformZoomDrawDebounce(setDrawPxPerSecState);

  const setLayoutIntentState = useCallback((intent: WaveformZoomLayoutIntent) => {
    layoutIntentRef.current = intent;
    setLayoutIntent(intent);
  }, []);

  const applyLayoutAndDraw = useCallback(
    (next: number) => {
      setLayoutPxPerSecState(next);
      flushDrawPxPerSec(next);
    },
    [flushDrawPxPerSec],
  );

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

  const commands = useWaveformZoomCommands({
    setLayoutIntentState,
    applyLayoutAndDraw,
    setLayoutPxPerSecState,
    scheduleDrawPxPerSec,
  });

  return {
    layoutPxPerSec,
    drawPxPerSec,
    pxPerSec: layoutPxPerSec,
    layoutIntent,
    layoutIntentRef,
    ...commands,
  };
}
