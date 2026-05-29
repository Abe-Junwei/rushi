import { describe, expect, it } from "vitest";
import { resolveWaveformZoomSliderRange } from "./pxPerSec";
import {
  computeZoomInPxPerSec,
  computeZoomOutPxPerSec,
  pxPerSecToSliderPos,
  sliderPosToPxPerSec,
} from "./waveformZoomSlider";

describe("waveformZoomSlider", () => {
  it("maps slider ends to fit-all and max px/s", () => {
    const range = resolveWaveformZoomSliderRange(800, 600);
    expect(sliderPosToPxPerSec(0, range)).toBeCloseTo(range.minPxPerSec, 4);
    expect(sliderPosToPxPerSec(1000, range)).toBeCloseTo(range.maxPxPerSec, 4);
    expect(pxPerSecToSliderPos(range.minPxPerSec, range)).toBe(0);
  });

  it("snaps zoom in/out to slider min when below manual range", () => {
    const range = resolveWaveformZoomSliderRange(800, 0.5);
    expect(range.minPxPerSec).toBeGreaterThan(400);
    expect(computeZoomInPxPerSec(56, range)).toBe(range.minPxPerSec);
    expect(computeZoomOutPxPerSec(56, range)).toBe(range.minPxPerSec);
  });
});
