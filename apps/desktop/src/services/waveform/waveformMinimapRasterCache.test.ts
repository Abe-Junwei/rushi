import { describe, expect, it } from "vitest";
import {
  canScaleMinimapRasterCache,
  createMinimapRasterCacheEntry,
} from "./waveformMinimapRasterCache";

describe("waveformMinimapRasterCache", () => {
  it("accepts cache when peaks reference and height match", () => {
    const peaks = new Float32Array([0, 1, 0, 1]);
    const source = document.createElement("canvas");
    source.width = 200;
    source.height = 40;
    const entry = createMinimapRasterCacheEntry(peaks, 200, 40, source);
    expect(canScaleMinimapRasterCache(entry, peaks, 40)).toBe(true);
    expect(canScaleMinimapRasterCache(entry, peaks, 56)).toBe(false);
  });

  it("rejects cache when peaks reference differs", () => {
    const peaks = new Float32Array([0, 1]);
    const other = new Float32Array([0, 2]);
    const source = document.createElement("canvas");
    source.width = 10;
    source.height = 10;
    const entry = createMinimapRasterCacheEntry(peaks, 10, 10, source);
    expect(canScaleMinimapRasterCache(entry, other, 10)).toBe(false);
  });
});
