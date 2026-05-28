export type WaveformPeaksDrawOptions = {
  heightPx: number;
  scrollLeftPx: number;
  viewportWidthPx: number;
  progressTimeSec: number;
  pxPerSec: number;
  durationSec: number;
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
  if (totalColumns <= 0) return;

  const dur = Math.max(opts.durationSec, 0.001);
  const peakWidthPx = Math.max(1, Math.ceil(dur * opts.pxPerSec));
  // totalColumns 可能因上采样限制而小于 peakWidthPx，取 min 防止越界
  const drawableColumns = Math.min(totalColumns, peakWidthPx);
  const mid = heightPx / 2;
  const amp = mid * 0.92;

  const maxScrollLeftPx = Math.max(0, drawableColumns - viewportWidthPx);
  const clampedScrollLeftPx = Math.max(0, Math.min(scrollLeftPx, maxScrollLeftPx));

  const startCol = Math.max(0, Math.floor(clampedScrollLeftPx));
  const endCol = Math.min(drawableColumns, Math.ceil(clampedScrollLeftPx + viewportWidthPx) + 1);

  const playheadTimelinePx = progressTimeSec * opts.pxPerSec;

  for (let col = startCol; col < endCol; col += step) {
    const min = interleavedPeaks[col * 2] ?? 0;
    const max = interleavedPeaks[col * 2 + 1] ?? 0;
    const x = col - clampedScrollLeftPx;
    if (x + barWidth < 0 || x > viewportWidthPx) continue;

    ctx.fillStyle = col + barWidth <= playheadTimelinePx ? progressColor : waveColor;

    const top = mid - max * amp;
    const bottom = mid - min * amp;
    const y = Math.min(top, bottom);
    const h = Math.max(1, Math.abs(bottom - top));
    ctx.fillRect(x, y, barWidth, h);
  }
}
