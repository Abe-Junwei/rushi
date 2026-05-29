import { describe, expect, it } from "vitest";
import { isPeaksCanvasTimelineMode, resolveWaveformTimelineMode } from "./waveformTimelineTypes";

describe("waveformTimelineTypes", () => {
  it("resolves peaks when PeakCache is present", () => {
    expect(resolveWaveformTimelineMode({})).toBe("peaks");
    expect(isPeaksCanvasTimelineMode("peaks")).toBe(true);
  });

  it("resolves decode-fallback when PeakCache is absent", () => {
    expect(resolveWaveformTimelineMode(null)).toBe("decode-fallback");
    expect(isPeaksCanvasTimelineMode("decode-fallback")).toBe(false);
  });
});
