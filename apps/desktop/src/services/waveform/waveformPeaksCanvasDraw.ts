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

/** Per-tile draw options for ADR-0004 content-tile renderer. No scroll, no progress. */
export type WaveformPeaksTileDrawOptions = {
  /** Tile's left edge in timeline pixel space (used to slice the right peak columns). */
  tileLeftPx: number;
  /** Tile's CSS width in pixels (may be < tileWidth at the last tile). */
  tileWidthPx: number;
  /**
   * Total timeline pixel width (= sum of all tile widths). Peaks are distributed
   * across this width, not across `durationSec * pxPerSec`. At very small
   * pxPerSec (e.g. fit-all on a long audio), `computeTimelineWidthPx` applies a
   * 320 px floor; without this explicit width, peaks would clump into the left
   * edge of the first tile and the rest of the timeline would render blank.
   */
  timelineWidthPx: number;
  heightPx: number;
  pxPerSec: number;
  durationSec: number;
  waveColor: string;
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
  // LOD 列数可少于时间轴像素（audiowaveform 不向上采样）；绘制时映射 timeline px ↔ peak 列。
  const drawableColumns = Math.min(totalColumns, peakWidthPx);
  const mid = heightPx / 2;
  const amp = mid * 0.92;

  const maxScrollTimelinePx = Math.max(0, peakWidthPx - viewportWidthPx);
  const clampedScrollTimelinePx = Math.max(0, Math.min(scrollLeftPx, maxScrollTimelinePx));

  const startCol = Math.max(
    0,
    Math.floor((clampedScrollTimelinePx * drawableColumns) / peakWidthPx),
  );
  let endCol = Math.min(
    drawableColumns,
    Math.ceil(((clampedScrollTimelinePx + viewportWidthPx) * drawableColumns) / peakWidthPx) + 1,
  );
  if (endCol <= startCol && drawableColumns > startCol) {
    endCol = Math.min(drawableColumns, startCol + 1);
  }

  const playheadTimelinePx = progressTimeSec * opts.pxPerSec;

  for (let col = startCol; col < endCol; col++) {
    if ((col - startCol) % step !== 0) continue;
    const min = interleavedPeaks[col * 2] ?? 0;
    const max = interleavedPeaks[col * 2 + 1] ?? 0;
    const colTimelinePx = (col * peakWidthPx) / drawableColumns;
    const x = colTimelinePx - clampedScrollTimelinePx;
    if (x + barWidth < 0 || x > viewportWidthPx) continue;

    ctx.fillStyle = colTimelinePx + barWidth <= playheadTimelinePx ? progressColor : waveColor;

    const top = mid - max * amp;
    const bottom = mid - min * amp;
    const y = Math.min(top, bottom);
    const h = Math.max(1, Math.abs(bottom - top));
    ctx.fillRect(x, y, barWidth, h);
  }
}

/**
 * Draw a single content-tile (ADR-0004). The tile owns timeline range
 * `[tileLeftPx, tileLeftPx + tileWidthPx]`. Coordinates inside `ctx` are
 * tile-local (0 ... tileWidthPx). No scroll, no progress — progress is a
 * separate DOM overlay (`WaveformProgressOverlay`).
 *
 * Returns `true` if drew anything, `false` if no-oped (caller may keep
 * the previous canvas content to avoid white flashes during transient
 * empty-peaks states, e.g. mid-zoom resample).
 */
export function drawWaveformPeaksTile(
  ctx: CanvasRenderingContext2D,
  interleavedPeaks: number[],
  opts: WaveformPeaksTileDrawOptions,
): boolean {
  const { heightPx, tileLeftPx, tileWidthPx, timelineWidthPx, waveColor } = opts;
  const barWidth = opts.barWidth ?? 2;
  const barGap = opts.barGap ?? 1;
  const step = barWidth + barGap;

  if (tileWidthPx <= 0 || heightPx <= 0 || interleavedPeaks.length < 2) return false;
  if (timelineWidthPx <= 0) return false;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  const totalColumns = interleavedPeaks.length / 2;
  if (totalColumns <= 0) return false;

  // Peaks are distributed evenly across the full timeline width (not across
  // `dur * pxPerSec`), so the fit-all floor in `computeTimelineWidthPx` doesn't
  // create empty trailing space. See WaveformPeaksTileDrawOptions for rationale.
  const drawableColumns = totalColumns;
  const distributionWidthPx = timelineWidthPx;

  const mid = heightPx / 2;
  const amp = mid * 0.92;

  if (tileLeftPx >= distributionWidthPx) return false;
  const tileRightPx = Math.min(distributionWidthPx, tileLeftPx + tileWidthPx);

  const startCol = Math.max(
    0,
    Math.floor((tileLeftPx * drawableColumns) / distributionWidthPx),
  );
  let endCol = Math.min(
    drawableColumns,
    Math.ceil((tileRightPx * drawableColumns) / distributionWidthPx) + 1,
  );
  if (endCol <= startCol && drawableColumns > startCol) {
    endCol = Math.min(drawableColumns, startCol + 1);
  }

  ctx.fillStyle = waveColor;

  for (let col = startCol; col < endCol; col++) {
    if ((col - startCol) % step !== 0) continue;
    const min = interleavedPeaks[col * 2] ?? 0;
    const max = interleavedPeaks[col * 2 + 1] ?? 0;
    const colTimelinePx = (col * distributionWidthPx) / drawableColumns;
    const x = colTimelinePx - tileLeftPx;
    if (x + barWidth < 0 || x > tileWidthPx) continue;

    const top = mid - max * amp;
    const bottom = mid - min * amp;
    const y = Math.min(top, bottom);
    const h = Math.max(1, Math.abs(bottom - top));
    ctx.fillRect(x, y, barWidth, h);
  }

  return true;
}
