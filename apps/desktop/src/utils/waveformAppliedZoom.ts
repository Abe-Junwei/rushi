import type { MutableRefObject } from "react";

/**
 * Imperative zoom/peaks state applied to WaveSurfer (TRUTH-010).
 * React `pxPerSec` from useWaveformZoom is user intent; these refs track what WS actually has.
 */
export type WaveformAppliedZoomState = {
  /** Last px/s passed to ws.zoom / shell layout (may lag React intent during resize). */
  appliedZoomPxPerSecRef: MutableRefObject<number>;
  /** px/s tier of last ws.load(peaks); NaN when decode-only. */
  appliedPeaksLoadPxPerSecRef: MutableRefObject<number>;
  /** Whether peaks were injected into the current WS instance. */
  appliedPeaksRef: MutableRefObject<boolean>;
};

export function createWaveformAppliedZoomState(initialPxPerSec: number): WaveformAppliedZoomState {
  return {
    appliedZoomPxPerSecRef: { current: initialPxPerSec },
    appliedPeaksLoadPxPerSecRef: { current: Number.NaN },
    appliedPeaksRef: { current: false },
  };
}
