import { describe, expect, it } from "vitest";
import source from "./projectWaveformWaveSurferEvents.ts?raw";

describe("projectWaveformWaveSurferEvents", () => {
  it("does not wrap requestWaveformSegmentBandPaint in requestAnimationFrame (S6)", () => {
    expect(source).toContain("requestWaveformSegmentBandPaint()");
    expect(source).not.toMatch(
      /requestAnimationFrame\s*\(\s*(?:\(\)\s*=>\s*)?\{[\s\S]{0,240}requestWaveformSegmentBandPaint/,
    );
    expect(source).toMatch(
      /const scheduleSegmentBandPaint = \(\) => \{\s*requestWaveformSegmentBandPaint\(\);\s*\};/,
    );
  });
});
