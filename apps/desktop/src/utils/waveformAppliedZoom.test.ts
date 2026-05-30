import { describe, expect, it } from "vitest";
import { createWaveformAppliedZoomState } from "./waveformAppliedZoom";

describe("createWaveformAppliedZoomState", () => {
  it("initializes WS and peaks tracking refs", () => {
    const state = createWaveformAppliedZoomState(56);
    expect(state.appliedZoomPxPerSecRef.current).toBe(56);
    expect(state.appliedPeaksLoadPxPerSecRef.current).toBeNaN();
    expect(state.appliedPeaksRef.current).toBe(false);
  });
});
