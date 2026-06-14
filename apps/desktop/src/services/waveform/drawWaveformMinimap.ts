import { COLORS } from "../../config/tokens";

export const WAVEFORM_MINIMAP_HEIGHT_PX = 56;
/** 峰值绘制区相对 canvas 高度的上下留白（居中对称柱形）。 */
const WAVEFORM_MINIMAP_PEAK_INSET_Y_RATIO = 0.22;

function peakHalfHeightPx(min: number, max: number, drawHalfH: number): number {
  const amp = Math.max(Math.abs(min), Math.abs(max), 0);
  return Math.max(1, amp * drawHalfH);
}

/** Draw interleaved min/max peaks (0..1) into a minimap canvas, vertically centered. */
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

  const insetY = Math.max(1, Math.round(h * WAVEFORM_MINIMAP_PEAK_INSET_Y_RATIO));
  const drawH = Math.max(1, h - insetY * 2);
  const midY = h / 2;
  const drawHalfH = drawH / 2;

  const drawColumn = (x: number, colW: number, min: number, max: number) => {
    const halfBar = peakHalfHeightPx(min, max, drawHalfH);
    const yTop = midY - halfBar;
    ctx.fillRect(x, yTop, Math.max(1, colW), Math.max(1, halfBar * 2));
  };

  if (colCount <= w) {
    const colW = w / colCount;
    for (let i = 0; i < colCount; i += 1) {
      drawColumn(i * colW, colW, peaks[i * 2] ?? 0, peaks[i * 2 + 1] ?? 0);
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
    drawColumn(x, 1, min, max);
  }
}
