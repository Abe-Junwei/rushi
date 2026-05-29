import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import {
  computeTileLayout,
  type ComputeTileLayoutInput,
  type TileLayout,
} from "../services/waveform/tileGeometry";
import { useWaveformTileLifecycle } from "./useWaveformTileLifecycle";

function layoutAt(scrollLeftPx: number, overrides?: Partial<ComputeTileLayoutInput>): TileLayout {
  return computeTileLayout({
    timelineWidthPx: 100_000,
    viewportWidthPx: 1_000,
    scrollLeftPx,
    barWidth: 2,
    barGap: 1,
    minTilePx: 4096,
    maxTilePx: 8000,
    overscanTiles: 1,
    ...overrides,
  });
}

describe("useWaveformTileLifecycle", () => {
  it("returns all visible+overscan tiles initially", () => {
    const layout = layoutAt(0);
    const { result } = renderHook(() =>
      useWaveformTileLifecycle({ layout, contentKey: "k0" }),
    );
    const indexes = result.current.activeTiles.map((t) => t.index);
    expect(indexes).toEqual(
      Array.from(
        { length: layout.visibleRange.endIndex - layout.visibleRange.startIndex + 1 },
        (_, i) => layout.visibleRange.startIndex + i,
      ),
    );
  });

  it("activeTiles are sorted by index", () => {
    const layout = layoutAt(50_000); // mid-scroll
    const { result } = renderHook(() =>
      useWaveformTileLifecycle({ layout, contentKey: "k0" }),
    );
    const indexes = result.current.activeTiles.map((t) => t.index);
    const sorted = [...indexes].sort((a, b) => a - b);
    expect(indexes).toEqual(sorted);
  });

  it("each active tile exposes leftPx/widthPx from layout.tileOf", () => {
    const layout = layoutAt(0);
    const { result } = renderHook(() =>
      useWaveformTileLifecycle({ layout, contentKey: "k0" }),
    );
    for (const tile of result.current.activeTiles) {
      const slot = layout.tileOf(tile.index);
      expect(tile.leftPx).toBe(slot.leftPx);
      expect(tile.widthPx).toBe(slot.widthPx);
    }
  });

  it("generation is constant when contentKey does not change", () => {
    const layout = layoutAt(0);
    const { result, rerender } = renderHook(
      ({ layout: l, contentKey: k }: { layout: TileLayout; contentKey: string }) =>
        useWaveformTileLifecycle({ layout: l, contentKey: k }),
      { initialProps: { layout, contentKey: "k0" } },
    );
    const gen1 = result.current.activeTiles[0].generation;
    rerender({ layout: layoutAt(2000), contentKey: "k0" });
    const gen2 = result.current.activeTiles[0].generation;
    expect(gen2).toBe(gen1);
  });

  it("bumps generation when layoutGeometryKey changes (viewport expand)", () => {
    const layout = layoutAt(0);
    const { result, rerender } = renderHook(
      ({
        layout: l,
        layoutGeometryKey,
      }: {
        layout: TileLayout;
        layoutGeometryKey: string;
      }) => useWaveformTileLifecycle({ layout: l, contentKey: "k0", layoutGeometryKey }),
      { initialProps: { layout, layoutGeometryKey: "vw400" } },
    );
    const gen1 = result.current.activeTiles[0].generation;
    rerender({ layout, layoutGeometryKey: "vw900" });
    for (const tile of result.current.activeTiles) {
      expect(tile.generation).toBe(gen1 + 1);
    }
  });

  it("bumps generation for all active tiles when contentKey changes", () => {
    const layout = layoutAt(0);
    const { result, rerender } = renderHook(
      ({ layout: l, contentKey: k }: { layout: TileLayout; contentKey: string }) =>
        useWaveformTileLifecycle({ layout: l, contentKey: k }),
      { initialProps: { layout, contentKey: "k0" } },
    );
    const gen1 = result.current.activeTiles[0].generation;
    rerender({ layout, contentKey: "k1" });
    for (const tile of result.current.activeTiles) {
      expect(tile.generation).toBe(gen1 + 1);
    }
  });

  it("retains visible tiles even when cap is exceeded", () => {
    // visible 跨度可能 1~2，但 overscan=1，加起来 ~ 4。cap=2 强制只能保留 visible。
    const layout = layoutAt(50_000);
    const visibleCount = layout.visibleRange.endIndex - layout.visibleRange.startIndex + 1;
    const { result } = renderHook(() =>
      useWaveformTileLifecycle({ layout, contentKey: "k0", cap: 2 }),
    );
    const activeIndexes = new Set(result.current.activeTiles.map((t) => t.index));
    for (let i = layout.visibleRange.startIndex; i <= layout.visibleRange.endIndex; i++) {
      expect(activeIndexes.has(i)).toBe(true);
    }
    expect(activeIndexes.size).toBeGreaterThanOrEqual(visibleCount);
  });

  it("keeps recently-visited tiles in LRU cache after scrolling away", () => {
    const layoutInitial = layoutAt(0);
    const { result, rerender } = renderHook(
      ({ layout }: { layout: TileLayout }) =>
        useWaveformTileLifecycle({ layout, contentKey: "k0", cap: 16 }),
      { initialProps: { layout: layoutInitial } },
    );
    const initialIndexes = result.current.activeTiles.map((t) => t.index);

    // Scroll forward — old indexes leave visible range but should still be in active set (within cap).
    const layoutLater = layoutAt(20_000);
    rerender({ layout: layoutLater });
    const laterIndexes = new Set(result.current.activeTiles.map((t) => t.index));
    for (const idx of initialIndexes) {
      expect(laterIndexes.has(idx)).toBe(true);
    }
  });

  it("evicts oldest non-visible tile when cap is reached", () => {
    let layout = layoutAt(0);
    const cap = 4;
    const { result, rerender } = renderHook(
      ({ layout: l }: { layout: TileLayout }) =>
        useWaveformTileLifecycle({ layout: l, contentKey: "k0", cap }),
      { initialProps: { layout } },
    );

    const firstActive = result.current.activeTiles.map((t) => t.index);

    // Walk the viewport forward by 1 tile at a time many times to exceed cap.
    for (let step = 1; step <= 10; step++) {
      layout = layoutAt(step * layout.tileWidthPx);
      rerender({ layout });
    }
    const finalActive = new Set(result.current.activeTiles.map((t) => t.index));
    expect(finalActive.size).toBeLessThanOrEqual(cap);
    // The very first tile (index 0) should have been evicted long ago.
    expect(finalActive.has(firstActive[0])).toBe(false);
  });

  it("re-adds previously evicted tiles when they become visible again", () => {
    let layout = layoutAt(0);
    const { result, rerender } = renderHook(
      ({ layout: l }: { layout: TileLayout }) =>
        useWaveformTileLifecycle({ layout: l, contentKey: "k0", cap: 4 }),
      { initialProps: { layout } },
    );
    for (let step = 1; step <= 10; step++) {
      layout = layoutAt(step * layout.tileWidthPx);
      rerender({ layout });
    }
    // Scroll back to 0
    layout = layoutAt(0);
    rerender({ layout });
    const activeIndexes = result.current.activeTiles.map((t) => t.index);
    expect(activeIndexes).toContain(layout.visibleRange.startIndex);
  });

  it("returns the same activeTiles ref when scroll changes but visible range does not", () => {
    // Two different layouts with identical visible range / totalTiles / tileWidthPx
    // (e.g. sub-tile scroll movement) should not produce a new activeTiles array.
    // This is what protects against jitter when the rAF scroll-poll updates state
    // but no tile boundary is actually crossed.
    const a = layoutAt(100); // small scroll inside first tile
    const b = layoutAt(150); // still inside first tile
    expect(a.visibleRange).toEqual(b.visibleRange);
    expect(a.totalTiles).toBe(b.totalTiles);
    expect(a.tileWidthPx).toBe(b.tileWidthPx);

    const { result, rerender } = renderHook(
      ({ layout }: { layout: TileLayout }) =>
        useWaveformTileLifecycle({ layout, contentKey: "k0" }),
      { initialProps: { layout: a } },
    );
    const before = result.current.activeTiles;
    rerender({ layout: b });
    const after = result.current.activeTiles;
    expect(after).toBe(before);
  });

  it("returns empty active tiles when layout has zero total tiles", () => {
    const layout = computeTileLayout({
      timelineWidthPx: 0,
      viewportWidthPx: 1000,
      scrollLeftPx: 0,
      barWidth: 2,
      barGap: 1,
    });
    const { result } = renderHook(() =>
      useWaveformTileLifecycle({ layout, contentKey: "k0" }),
    );
    expect(result.current.activeTiles).toEqual([]);
  });
});
