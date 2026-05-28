import { describe, expect, it } from "vitest";
import { resolveWaveformZoomSliderRange } from "./pxPerSec";
import { pxPerSecToSliderPos, sliderPosToPxPerSec } from "./waveformZoomSlider";

describe("waveformZoomSlider", () => {
  it("maps slider ends to fit-all and max px/s", () => {
    const range = resolveWaveformZoomSliderRange(800, 600);
    expect(sliderPosToPxPerSec(0, range)).toBeCloseTo(range.minPxPerSec, 4);
    expect(sliderPosToPxPerSec(1000, range)).toBeCloseTo(range.maxPxPerSec, 4);
    expect(pxPerSecToSliderPos(range.minPxPerSec, range)).toBe(0);
  });
});
