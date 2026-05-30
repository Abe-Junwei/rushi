import { COLORS } from "../../config/tokens";

export const WAVEFORM_MINIMAP_HEIGHT_PX = 40;

/** Draw interleaved min/max peaks (0..1) into a minimap canvas. */
export function drawWaveformMinimap(
  ctx: CanvasRenderingContext2D,
  peaks: ArrayLike<number>,
  widthPx: number,
  heightPx: number,
): void {
  const w = Math.max(1, Math.floor(widthPx));
  const h = Math.max(1, Math.floor(heightPx));
  ctx.clearRect(0, 0, w, h);
  const colCount = Math.max(1, Math.floor(peaks.length / 2));
  ctx.fillStyle = COLORS.waveformWave;

  if (colCount <= w) {
    const colW = w / colCount;
    for (let i = 0; i < colCount; i += 1) {
      const min = peaks[i * 2] ?? 0;
      const max = peaks[i * 2 + 1] ?? 0;
      const yTop = (1 - Math.max(min, max)) * h;
      const yBottom = (1 - Math.min(min, max)) * h;
      ctx.fillRect(i * colW, yTop, Math.max(1, colW), Math.max(1, yBottom - yTop));
    }
    return;
  }

  // Bucket when source columns exceed canvas width (un-resampled peaks / decode export).
  for (let x = 0; x < w; x += 1) {
    const start = Math.floor((x * colCount) / w);
    const end = Math.floor(((x + 1) * colCount) / w);
    let min = 0;
    let max = 0;
    for (let i = start; i < end; i += 1) {
      const pMin = peaks[i * 2] ?? 0;
      const pMax = peaks[i * 2 + 1] ?? 0;
      min = Math.min(min, pMin);
      max = Math.max(max, pMax);
    }
    const yTop = (1 - Math.max(min, max)) * h;
    const yBottom = (1 - Math.min(min, max)) * h;
    ctx.fillRect(x, yTop, 1, Math.max(1, yBottom - yTop));
  }
}
