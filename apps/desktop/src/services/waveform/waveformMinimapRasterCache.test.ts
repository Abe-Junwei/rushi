import { describe, expect, it } from "vitest";
import {
  blitMinimapRasterAtSize,
  blitScaledMinimapRaster,
  canScaleMinimapRasterCache,
  createMinimapRasterCacheEntry,
} from "./waveformMinimapRasterCache";

describe("waveformMinimapRasterCache", () => {
  it("preserves device-pixel backing store (no Retina downsample)", () => {
    const peaks = new Float32Array([0, 1, 0, 1]);
    const source = document.createElement("canvas");
    // Simulate dpr=2 paint: CSS 200×40 → device 400×80
    source.width = 400;
    source.height = 80;
    const entry = createMinimapRasterCacheEntry(peaks, 200, 40, source);
    expect(entry.canvas.width).toBe(400);
    expect(entry.canvas.height).toBe(80);
    expect(entry.widthPx).toBe(200);
    expect(entry.heightPx).toBe(40);
    expect(canScaleMinimapRasterCache(entry, peaks, 40)).toBe(true);
    expect(canScaleMinimapRasterCache(entry, peaks, 56)).toBe(false);
  });

  it("rejects cache when peaks reference differs", () => {
    const peaks = new Float32Array([0, 1]);
    const other = new Float32Array([0, 2]);
    const source = document.createElement("canvas");
    source.width = 20;
    source.height = 20;
    const entry = createMinimapRasterCacheEntry(peaks, 10, 10, source);
    expect(canScaleMinimapRasterCache(entry, other, 10)).toBe(false);
  });

  it("blits with device-pixel source rect under CSS user space", () => {
    const peaks = new Float32Array([0, 1]);
    const source = document.createElement("canvas");
    source.width = 400;
    source.height = 80;
    const entry = createMinimapRasterCacheEntry(peaks, 200, 40, source);
    const calls: Array<{ args: unknown[] }> = [];
    const ctx = {
      imageSmoothingEnabled: true,
      clearRect() {},
      drawImage(...args: unknown[]) {
        calls.push({ args });
      },
    } as unknown as CanvasRenderingContext2D;

    blitMinimapRasterAtSize(ctx, entry, 200, 40);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.args).toEqual([entry.canvas, 0, 0, 400, 80, 0, 0, 200, 40]);

    calls.length = 0;
    blitScaledMinimapRaster(ctx, entry, 300, 40);
    expect(calls[0]?.args).toEqual([entry.canvas, 0, 0, 400, 80, 0, 0, 300, 40]);
  });
});
