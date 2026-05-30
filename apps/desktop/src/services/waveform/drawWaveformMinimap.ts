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
  const colW = w / colCount;
  ctx.fillStyle = COLORS.waveformWave;
  for (let i = 0; i < colCount; i += 1) {
    const min = peaks[i * 2] ?? 0;
    const max = peaks[i * 2 + 1] ?? 0;
    const yTop = (1 - Math.max(min, max)) * h;
    const yBottom = (1 - Math.min(min, max)) * h;
    ctx.fillRect(i * colW, yTop, Math.max(1, colW), Math.max(1, yBottom - yTop));
  }
}
