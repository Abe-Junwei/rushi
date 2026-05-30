import type { MutableRefObject } from "react";

/**
 * Imperative zoom/peaks state applied to WaveSurfer (TRUTH-010).
 * React `pxPerSec` from useWaveformZoom is user intent; this tracks WS truth.
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

export function markAppliedZoomWs(state: WaveformAppliedZoomState, pxPerSec: number): void {
  state.appliedZoomPxPerSecRef.current = pxPerSec;
}

export function markAppliedPeaks(
  state: WaveformAppliedZoomState,
  applied: boolean,
  loadPeaksPx: number,
): void {
  state.appliedPeaksRef.current = applied;
  state.appliedPeaksLoadPxPerSecRef.current = applied ? loadPeaksPx : Number.NaN;
}

export function resetAppliedPeaks(state: WaveformAppliedZoomState): void {
  markAppliedPeaks(state, false, Number.NaN);
}

export function readLoadedPeaksPx(state: WaveformAppliedZoomState): number {
  return state.appliedPeaksLoadPxPerSecRef.current;
}

export function isPeaksLoadedIntoWs(state: WaveformAppliedZoomState): boolean {
  return state.appliedPeaksRef.current === true;
}

export function appliedZoomMatchesIntent(
  state: WaveformAppliedZoomState,
  intentPxPerSec: number,
  epsilon = 1e-6,
): boolean {
  return Math.abs(state.appliedZoomPxPerSecRef.current - intentPxPerSec) <= epsilon;
}
