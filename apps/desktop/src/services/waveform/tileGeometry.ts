/**
 * Tile geometry for content-tile peaks rendering (ADR-0004).
 *
 * Pure functions only — no React, no DOM. Used by `WaveformPeaksTileLayer` to:
 * 1. Decide tile width (clamped to safe Canvas size, aligned to bar grid)
 * 2. Compute which tile indexes are visible for a given scrollLeft / viewport
 * 3. Compute (leftPx, widthPx) for any tile index
 *
 * Tile width strategy (per ADR-0004 / plan §决策 1):
 *   tileWidthPx = clamp(viewport × 2, MIN_TILE_PX, MAX_TILE_PX)
 *   then floor to nearest (barWidth + barGap) so adjacent tiles align on bars
 */

export const TILE_GEOMETRY_DEFAULTS = {
  /** Conservative single-canvas safe width (Chrome). Safari WebView ~4096 but desktop is Chromium. */
  maxTilePx: 8000,
  /** Below this, tile-switch frequency hurts; above viewport-only, scroll feels smooth. */
  minTilePx: 4096,
  /** Pad visible range with N tiles on each side to avoid pop-in during scroll. */
  overscanTiles: 3,
} as const;

export type TileSlot = {
  index: number;
  leftPx: number;
  widthPx: number;
};

export type TileLayout = {
  tileWidthPx: number;
  totalTiles: number;
  visibleRange: { startIndex: number; endIndex: number };
  /** Resolve a tile slot by index. Last tile may be narrower than `tileWidthPx`. */
  tileOf: (index: number) => TileSlot;
};

export type ComputeTileLayoutInput = {
  timelineWidthPx: number;
  viewportWidthPx: number;
  scrollLeftPx: number;
  /** Bar grid for alignment (matches waveformPeaksCanvasDraw defaults). */
  barWidth: number;
  barGap: number;
  maxTilePx?: number;
  minTilePx?: number;
  overscanTiles?: number;
};

/**
 * Resolve tile width — clamped to safe range and floored to bar grid so adjacent
 * tiles share column boundaries (avoids 1px misalignment at tile seams).
 */
export function resolveTileWidthPx(input: {
  viewportWidthPx: number;
  barWidth: number;
  barGap: number;
  maxTilePx?: number;
  minTilePx?: number;
}): number {
  const maxTilePx = input.maxTilePx ?? TILE_GEOMETRY_DEFAULTS.maxTilePx;
  const minTilePx = input.minTilePx ?? TILE_GEOMETRY_DEFAULTS.minTilePx;
  const step = Math.max(1, input.barWidth + input.barGap);
  const raw = Math.max(minTilePx, Math.min(maxTilePx, input.viewportWidthPx * 2));
  // Floor to bar grid; never go below minTilePx via flooring alone.
  const aligned = Math.floor(raw / step) * step;
  return Math.max(step, aligned);
}

export function computeTileLayout(input: ComputeTileLayoutInput): TileLayout {
  const timelineWidthPx = Math.max(0, input.timelineWidthPx);
  const viewportWidthPx = Math.max(0, input.viewportWidthPx);
  const overscan = input.overscanTiles ?? TILE_GEOMETRY_DEFAULTS.overscanTiles;

  if (timelineWidthPx <= 0 || viewportWidthPx <= 0) {
    const tileWidthPx = resolveTileWidthPx(input);
    return {
      tileWidthPx,
      totalTiles: 0,
      visibleRange: { startIndex: 0, endIndex: -1 },
      tileOf: (index) => ({ index, leftPx: index * tileWidthPx, widthPx: 0 }),
    };
  }

  const tileWidthPx = resolveTileWidthPx(input);
  const totalTiles = Math.max(1, Math.ceil(timelineWidthPx / tileWidthPx));

  const scrollLeftPx = Math.max(0, Math.min(input.scrollLeftPx, Math.max(0, timelineWidthPx - viewportWidthPx)));
  const rawStart = Math.floor(scrollLeftPx / tileWidthPx) - overscan;
  const rawEnd = Math.ceil((scrollLeftPx + viewportWidthPx) / tileWidthPx) - 1 + overscan;
  const startIndex = Math.max(0, Math.min(totalTiles - 1, rawStart));
  const endIndex = Math.max(startIndex, Math.min(totalTiles - 1, rawEnd));

  const tileOf = (index: number): TileSlot => {
    const leftPx = index * tileWidthPx;
    const widthPx = Math.max(0, Math.min(tileWidthPx, timelineWidthPx - leftPx));
    return { index, leftPx, widthPx };
  };

  return {
    tileWidthPx,
    totalTiles,
    visibleRange: { startIndex, endIndex },
    tileOf,
  };
}

/** Enumerate slots in visible range (inclusive). */
export function enumerateVisibleTiles(layout: TileLayout): TileSlot[] {
  const { startIndex, endIndex } = layout.visibleRange;
  if (endIndex < startIndex) return [];
  const out: TileSlot[] = [];
  for (let i = startIndex; i <= endIndex; i++) out.push(layout.tileOf(i));
  return out;
}
