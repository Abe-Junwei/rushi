export type WaveformPeaksDrawOptions = {
  heightPx: number;
  scrollLeftPx: number;
  viewportWidthPx: number;
  progressTimeSec: number;
  pxPerSec: number;
  waveColor: string;
  progressColor: string;
  barWidth?: number;
  barGap?: number;
};

/** Draw visible min/max columns from interleaved WaveSurfer peaks `[min0,max0,min1,max1,...]`. */
export function drawWaveformPeaksViewport(
  ctx: CanvasRenderingContext2D,
  interleavedPeaks: number[],
  opts: WaveformPeaksDrawOptions,
): void {
  const { heightPx, scrollLeftPx, viewportWidthPx, progressTimeSec, waveColor, progressColor } = opts;
  const barWidth = opts.barWidth ?? 2;
  const barGap = opts.barGap ?? 1;
  const step = barWidth + barGap;

  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  if (viewportWidthPx <= 0 || heightPx <= 0 || interleavedPeaks.length < 2) return;

  const totalColumns = interleavedPeaks.length / 2;
  const progressPx = progressTimeSec * opts.pxPerSec;
  const mid = heightPx / 2;
  const amp = mid * 0.92;

  const startCol = Math.max(0, Math.floor(scrollLeftPx / step));
  const endCol = Math.min(totalColumns, Math.ceil((scrollLeftPx + viewportWidthPx) / step) + 1);

  for (let col = startCol; col < endCol; col += 1) {
    const min = interleavedPeaks[col * 2] ?? 0;
    const max = interleavedPeaks[col * 2 + 1] ?? 0;
    const x = col * step - scrollLeftPx;
    if (x + barWidth < 0 || x > viewportWidthPx) continue;

    ctx.fillStyle = col * step <= progressPx ? progressColor : waveColor;

    const top = mid - max * amp;
    const bottom = mid - min * amp;
    const y = Math.min(top, bottom);
    const h = Math.max(1, Math.abs(bottom - top));
    ctx.fillRect(x, y, barWidth, h);
  }
}
