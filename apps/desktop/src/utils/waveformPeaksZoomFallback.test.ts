import { describe, expect, it } from "vitest";
import {
  resolvePeakLodLevelForPxPerSec,
  shouldZoomOnlyWithLoadedPeaksStretch,
} from "./waveformPeaksZoomFallback";

describe("resolvePeakLodLevelForPxPerSec", () => {
  it("maps manual editing px/s to L2", () => {
    expect(resolvePeakLodLevelForPxPerSec(56)).toBe(2);
    expect(resolvePeakLodLevelForPxPerSec(120)).toBe(2);
  });

  it("maps high zoom to L3", () => {
    expect(resolvePeakLodLevelForPxPerSec(250)).toBe(3);
  });

  it("maps sub-min fit-all to L0", () => {
    expect(resolvePeakLodLevelForPxPerSec(0.083)).toBe(0);
  });
});

describe("shouldZoomOnlyWithLoadedPeaksStretch", () => {
  it("returns false when peaks are not loaded", () => {
    expect(
      shouldZoomOnlyWithLoadedPeaksStretch({
        intentPxPerSec: 80,
        loadedPeaksPxPerSec: 56,
        peaksLoadedIntoWaveSurfer: false,
      }),
    ).toBe(false);
  });

  it("returns true when crossing 8 px/s quanta within the same LOD", () => {
    expect(
      shouldZoomOnlyWithLoadedPeaksStretch({
        intentPxPerSec: 120,
        loadedPeaksPxPerSec: 56,
        peaksLoadedIntoWaveSurfer: true,
      }),
    ).toBe(true);
  });

  it("returns false when intent needs a finer LOD tier", () => {
    expect(
      shouldZoomOnlyWithLoadedPeaksStretch({
        intentPxPerSec: 250,
        loadedPeaksPxPerSec: 56,
        peaksLoadedIntoWaveSurfer: true,
      }),
    ).toBe(false);
  });

  it("returns true for sub-min refit on the same sparse LOD", () => {
    expect(
      shouldZoomOnlyWithLoadedPeaksStretch({
        intentPxPerSec: 0.133,
        loadedPeaksPxPerSec: 0.083,
        peaksLoadedIntoWaveSurfer: true,
      }),
    ).toBe(true);
  });
});
