import { describe, it, expect } from "vitest";
import {
  TILE_GEOMETRY_DEFAULTS,
  computeTileLayout,
  enumerateVisibleTiles,
  resolveTileWidthPx,
} from "./tileGeometry";

const BAR = { barWidth: 2, barGap: 1 };

describe("resolveTileWidthPx", () => {
  it("clamps to [minTilePx, maxTilePx]", () => {
    expect(resolveTileWidthPx({ viewportWidthPx: 500, ...BAR })).toBe(
      Math.floor(TILE_GEOMETRY_DEFAULTS.minTilePx / 3) * 3,
    );
    expect(resolveTileWidthPx({ viewportWidthPx: 5000, ...BAR })).toBe(
      Math.floor(TILE_GEOMETRY_DEFAULTS.maxTilePx / 3) * 3,
    );
  });

  it("floors to bar grid (barWidth + barGap)", () => {
    const step = BAR.barWidth + BAR.barGap;
    const w = resolveTileWidthPx({ viewportWidthPx: 2500, ...BAR });
    expect(w % step).toBe(0);
  });

  it("returns at least one bar step even when inputs degenerate", () => {
    const w = resolveTileWidthPx({
      viewportWidthPx: 0,
      barWidth: 2,
      barGap: 1,
      minTilePx: 0,
      maxTilePx: 0,
    });
    expect(w).toBeGreaterThanOrEqual(3);
  });
});

describe("computeTileLayout", () => {
  it("returns empty when timeline is 0", () => {
    const layout = computeTileLayout({
      timelineWidthPx: 0,
      viewportWidthPx: 800,
      scrollLeftPx: 0,
      ...BAR,
    });
    expect(layout.totalTiles).toBe(0);
    expect(layout.visibleRange.endIndex).toBeLessThan(layout.visibleRange.startIndex);
    expect(enumerateVisibleTiles(layout)).toEqual([]);
  });

  it("returns single tile when timeline < tileWidth", () => {
    const layout = computeTileLayout({
      timelineWidthPx: 1000,
      viewportWidthPx: 800,
      scrollLeftPx: 0,
      ...BAR,
    });
    expect(layout.totalTiles).toBe(1);
    expect(layout.visibleRange.startIndex).toBe(0);
    expect(layout.visibleRange.endIndex).toBe(0);
    const tile = layout.tileOf(0);
    expect(tile.leftPx).toBe(0);
    expect(tile.widthPx).toBe(1000);
  });

  it("returns multiple tiles for long timeline", () => {
    const layout = computeTileLayout({
      timelineWidthPx: 30000,
      viewportWidthPx: 1200,
      scrollLeftPx: 0,
      ...BAR,
    });
    expect(layout.totalTiles).toBeGreaterThan(1);
    const tile0 = layout.tileOf(0);
    const tile1 = layout.tileOf(1);
    expect(tile1.leftPx).toBe(tile0.leftPx + layout.tileWidthPx);
  });

  it("last tile width is clamped to timeline end", () => {
    const layout = computeTileLayout({
      timelineWidthPx: 10000,
      viewportWidthPx: 800,
      scrollLeftPx: 0,
      ...BAR,
    });
    const last = layout.tileOf(layout.totalTiles - 1);
    expect(last.leftPx + last.widthPx).toBe(10000);
    expect(last.widthPx).toBeLessThanOrEqual(layout.tileWidthPx);
  });

  it("visibleRange covers viewport + overscan and never exceeds totalTiles", () => {
    const layout = computeTileLayout({
      timelineWidthPx: 100000,
      viewportWidthPx: 1200,
      scrollLeftPx: 50000,
      ...BAR,
    });
    const { startIndex, endIndex } = layout.visibleRange;
    expect(startIndex).toBeGreaterThanOrEqual(0);
    expect(endIndex).toBeLessThan(layout.totalTiles);
    const startLeft = layout.tileOf(startIndex).leftPx;
    const endRight = layout.tileOf(endIndex).leftPx + layout.tileOf(endIndex).widthPx;
    expect(startLeft).toBeLessThanOrEqual(50000);
    expect(endRight).toBeGreaterThanOrEqual(50000 + 1200);
  });

  it("scrollLeft clamped past timeline still yields valid visible tiles at end", () => {
    const layout = computeTileLayout({
      timelineWidthPx: 20000,
      viewportWidthPx: 1200,
      scrollLeftPx: 999999,
      ...BAR,
    });
    expect(layout.visibleRange.endIndex).toBe(layout.totalTiles - 1);
  });

  it("scrollLeft at 0 with overscan=1 starts visible at tile 0", () => {
    const layout = computeTileLayout({
      timelineWidthPx: 30000,
      viewportWidthPx: 1200,
      scrollLeftPx: 0,
      ...BAR,
    });
    expect(layout.visibleRange.startIndex).toBe(0);
  });

  it("enumerateVisibleTiles returns expected count", () => {
    const layout = computeTileLayout({
      timelineWidthPx: 100000,
      viewportWidthPx: 1200,
      scrollLeftPx: 30000,
      ...BAR,
    });
    const tiles = enumerateVisibleTiles(layout);
    expect(tiles.length).toBe(layout.visibleRange.endIndex - layout.visibleRange.startIndex + 1);
    expect(tiles[0]?.index).toBe(layout.visibleRange.startIndex);
  });
});
