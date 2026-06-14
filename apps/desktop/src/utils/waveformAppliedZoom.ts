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
  /** layout duration (sec) passed to last ws.load(peaks); 0 when decode-only. */
  appliedPeaksLayoutDurSecRef: MutableRefObject<number>;
  /** Whether peaks were injected into the current WS instance. */
  appliedPeaksRef: MutableRefObject<boolean>;
};

export function createWaveformAppliedZoomState(initialPxPerSec: number): WaveformAppliedZoomState {
  return {
    appliedZoomPxPerSecRef: { current: initialPxPerSec },
    appliedPeaksLoadPxPerSecRef: { current: Number.NaN },
    appliedPeaksLayoutDurSecRef: { current: 0 },
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
  layoutDurSec = 0,
): void {
  state.appliedPeaksRef.current = applied;
  state.appliedPeaksLoadPxPerSecRef.current = applied ? loadPeaksPx : Number.NaN;
  state.appliedPeaksLayoutDurSecRef.current =
    applied && layoutDurSec > 0 ? layoutDurSec : 0;
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
