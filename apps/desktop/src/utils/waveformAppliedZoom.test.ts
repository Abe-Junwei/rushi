import { describe, expect, it } from "vitest";
import {
  appliedZoomMatchesIntent,
  createWaveformAppliedZoomState,
  isPeaksLoadedIntoWs,
  markAppliedPeaks,
  markAppliedZoomWs,
  readLoadedPeaksPx,
  resetAppliedPeaks,
} from "./waveformAppliedZoom";

describe("createWaveformAppliedZoomState", () => {
  it("initializes WS and peaks tracking refs", () => {
    const state = createWaveformAppliedZoomState(56);
    expect(state.appliedZoomPxPerSecRef.current).toBe(56);
    expect(state.appliedPeaksLoadPxPerSecRef.current).toBeNaN();
    expect(state.appliedPeaksRef.current).toBe(false);
  });
});

describe("waveformAppliedZoom helpers", () => {
  it("tracks WS zoom and peaks load tiers", () => {
    const state = createWaveformAppliedZoomState(56);
    markAppliedZoomWs(state, 80);
    markAppliedPeaks(state, true, 80, 120);
    expect(appliedZoomMatchesIntent(state, 80)).toBe(true);
    expect(isPeaksLoadedIntoWs(state)).toBe(true);
    expect(readLoadedPeaksPx(state)).toBe(80);
    expect(state.appliedPeaksLayoutDurSecRef.current).toBe(120);
    resetAppliedPeaks(state);
    expect(state.appliedPeaksLayoutDurSecRef.current).toBe(0);
    expect(isPeaksLoadedIntoWs(state)).toBe(false);
    expect(readLoadedPeaksPx(state)).toBeNaN();
  });
});
