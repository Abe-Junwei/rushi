import { describe, expect, it } from "vitest";
import { pickPeakLodLevel, PEAK_LOD_LEVELS } from "./peakLevels";

describe("pickPeakLodLevel", () => {
  it("picks L0 for very low px/s", () => {
    expect(pickPeakLodLevel(0.2)).toBe(PEAK_LOD_LEVELS[0]!.level);
  });

  it("picks L2 for default editing zoom (56 < 200, need downsample-capable base)", () => {
    expect(pickPeakLodLevel(56)).toBe(PEAK_LOD_LEVELS[2]!.level);
  });

  it("picks L2 for high zoom", () => {
    expect(pickPeakLodLevel(200)).toBe(PEAK_LOD_LEVELS[2]!.level);
  });

  it("falls back to finest level when target exceeds all LODs", () => {
    expect(pickPeakLodLevel(500)).toBe(PEAK_LOD_LEVELS[2]!.level);
  });
});
