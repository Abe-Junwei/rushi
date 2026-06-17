import { describe, expect, it } from "vitest";
import {
  resolveDefaultEditingPxPerSec,
  resolveWaveformZoomSliderRange,
  resolveWaveformZoomStepRatio,
} from "./pxPerSec";
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

  it("steps zoom in/out by per-file step ratio within slider range", () => {
    const range = resolveWaveformZoomSliderRange(800, 600);
    const start = resolveDefaultEditingPxPerSec(800, 600);
    const ratio = resolveWaveformZoomStepRatio(range);
    expect(computeZoomInPxPerSec(start, range)).toBeCloseTo(start * ratio, 6);
    expect(computeZoomOutPxPerSec(start, range)).toBeCloseTo(start / ratio, 6);
  });

  it("zoom in increases px/s for long media within render cap", () => {
    const range = resolveWaveformZoomSliderRange(960, 600);
    const start = resolveDefaultEditingPxPerSec(960, 600);
    const next = computeZoomInPxPerSec(start, range);
    expect(next).toBeGreaterThan(start + 0.01);
    expect(next).toBeLessThanOrEqual(range.maxPxPerSec + 1e-6);
  });
});
