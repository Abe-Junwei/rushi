import { describe, expect, it } from "vitest";
import { pickPeakLodLevel, PEAK_LOD_LEVELS } from "./peakLevels";

describe("pickPeakLodLevel", () => {
  it("picks L0 for very low px/s", () => {
    expect(pickPeakLodLevel(0.2)).toBe(PEAK_LOD_LEVELS[0]!.level);
  });

  it("picks L1 for default editing zoom", () => {
    expect(pickPeakLodLevel(56)).toBe(PEAK_LOD_LEVELS[1]!.level);
  });

  it("picks L2 for high zoom", () => {
    expect(pickPeakLodLevel(200)).toBe(PEAK_LOD_LEVELS[2]!.level);
  });
});
