import { useCallback } from "react";
import {
  clampPxPerSec,
  clampPxPerSecForFitSelection,
  computeFitAllPxPerSec,
  resolveDefaultResetPxPerSec,
  TIMELINE_PX_PER_SEC,
  type WaveformZoomLayoutIntent,
} from "../utils/pxPerSec";
import { isPxPerSecNearFitAll, isNearEditingDefaultForMedia } from "../utils/waveformZoomBarState";

type WaveformZoomCommandDeps = {
  setLayoutIntentState: (intent: WaveformZoomLayoutIntent) => void;
  applyLayoutAndDraw: (next: number) => void;
  setLayoutPxPerSecState: React.Dispatch<React.SetStateAction<number>>;
  scheduleDrawPxPerSec: (next: number) => void;
};

export function useWaveformZoomCommands(deps: WaveformZoomCommandDeps) {
  const {
    setLayoutIntentState,
    applyLayoutAndDraw,
    setLayoutPxPerSecState,
    scheduleDrawPxPerSec,
  } = deps;

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
    [scheduleDrawPxPerSec, setLayoutIntentState, setLayoutPxPerSecState],
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
    applyFitAllRefitPxPerSec,
    enterFitAllLayout,
    setPxPerSec,
    setPxPerSecFromSlider,
    resetZoom,
    resetZoomForMedia,
    setFitPxPerSec,
  };
}
