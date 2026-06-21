/** Offscreen raster cache for minimap peaks draw (resize scale without redraw). */

export type MinimapRasterCacheEntry = {
  peaks: Float32Array;
  widthPx: number;
  heightPx: number;
  canvas: HTMLCanvasElement;
};

export function createMinimapRasterCacheEntry(
  peaks: Float32Array,
  widthPx: number,
  heightPx: number,
  sourceCanvas: HTMLCanvasElement,
): MinimapRasterCacheEntry {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(widthPx));
  canvas.height = Math.max(1, Math.floor(heightPx));
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.drawImage(sourceCanvas, 0, 0, canvas.width, canvas.height);
  }
  return { peaks, widthPx: canvas.width, heightPx: canvas.height, canvas };
}

export function canScaleMinimapRasterCache(
  entry: MinimapRasterCacheEntry | null,
  peaks: Float32Array,
  heightPx: number,
): entry is MinimapRasterCacheEntry {
  if (!entry) return false;
  if (entry.peaks !== peaks) return false;
  if (entry.heightPx !== Math.max(1, Math.floor(heightPx))) return false;
  return true;
}

export function blitScaledMinimapRaster(
  ctx: CanvasRenderingContext2D,
  entry: MinimapRasterCacheEntry,
  widthPx: number,
  heightPx: number,
): void {
  const w = Math.max(1, Math.floor(widthPx));
  const h = Math.max(1, Math.floor(heightPx));
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(entry.canvas, 0, 0, entry.widthPx, entry.heightPx, 0, 0, w, h);
}
