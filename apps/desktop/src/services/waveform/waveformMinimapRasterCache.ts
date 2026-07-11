/** Offscreen raster cache for minimap peaks draw (resize scale without redraw). */

export type MinimapRasterCacheEntry = {
  peaks: Float32Array;
  /** CSS (layout) width of the painted minimap. */
  widthPx: number;
  /** CSS (layout) height of the painted minimap. */
  heightPx: number;
  /** Backing store at device-pixel resolution (matches source canvas). */
  canvas: HTMLCanvasElement;
};

/**
 * Snapshot the painted minimap at full device-pixel resolution.
 * Downsampling to CSS size here would blur on Retina when later upscaled.
 */
export function createMinimapRasterCacheEntry(
  peaks: Float32Array,
  widthPx: number,
  heightPx: number,
  sourceCanvas: HTMLCanvasElement,
): MinimapRasterCacheEntry {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, sourceCanvas.width);
  canvas.height = Math.max(1, sourceCanvas.height);
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sourceCanvas, 0, 0);
  }
  return {
    peaks,
    widthPx: Math.max(1, Math.floor(widthPx)),
    heightPx: Math.max(1, Math.floor(heightPx)),
    canvas,
  };
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

/** Blit cached raster into a ctx that already has `setTransform(dpr, …)` (CSS user space). */
export function blitScaledMinimapRaster(
  ctx: CanvasRenderingContext2D,
  entry: MinimapRasterCacheEntry,
  widthPx: number,
  heightPx: number,
): void {
  const w = Math.max(1, Math.floor(widthPx));
  const h = Math.max(1, Math.floor(heightPx));
  ctx.clearRect(0, 0, w, h);
  const prevSmooth = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(entry.canvas, 0, 0, entry.canvas.width, entry.canvas.height, 0, 0, w, h);
  ctx.imageSmoothingEnabled = prevSmooth;
}

/** 1:1 blit when CSS size matches the cache entry (still under dpr transform). */
export function blitMinimapRasterAtSize(
  ctx: CanvasRenderingContext2D,
  entry: MinimapRasterCacheEntry,
  widthPx: number,
  heightPx: number,
): void {
  const w = Math.max(1, Math.floor(widthPx));
  const h = Math.max(1, Math.floor(heightPx));
  ctx.clearRect(0, 0, w, h);
  const prevSmooth = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(entry.canvas, 0, 0, entry.canvas.width, entry.canvas.height, 0, 0, w, h);
  ctx.imageSmoothingEnabled = prevSmooth;
}
