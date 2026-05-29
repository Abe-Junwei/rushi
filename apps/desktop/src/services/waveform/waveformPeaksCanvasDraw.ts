import { PEAKS_MEDIA_MIN_COVERAGE_RATIO } from "../../utils/peakMediaDuration";

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
  /** Duration covered by resampled peak columns. */
  peakDurationSec: number;
  /** Media / layout timeline duration (may exceed peak file). */
  mediaDurationSec: number;
  waveColor: string;
  barWidth?: number;
  barGap?: number;
  /** Overview minimap: stretch all peak columns across the full layout width. */
  fillLayoutWidth?: boolean;
};

/**
 * Resize canvas backing store to match CSS size at current DPR and return
 * a 2D context with DPR transform applied. Shared by `WaveformPeaksTile`
 * and `WaveformOverviewPeaksCanvas` to avoid duplicate sizing logic.
 */
export function prepareCanvasDprDraw(
  canvas: HTMLCanvasElement,
  cssW: number,
  cssH: number,
): CanvasRenderingContext2D | null {
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const targetW = Math.round(Math.max(1, cssW) * dpr);
  const targetH = Math.round(Math.max(1, cssH) * dpr);
  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW;
    canvas.height = targetH;
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

/**
 * Draw a single content-tile (ADR-0004). The tile owns timeline range
 * `[tileLeftPx, tileLeftPx + tileWidthPx]`. Coordinates inside `ctx` are
 * tile-local (0 ... tileWidthPx). No scroll — progress tint is not rendered on
 * the tile path (overview uses a separate playhead line).
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

  const totalColumns = interleavedPeaks.length / 2;
  if (totalColumns <= 0) return false;

  const layoutWidthPx = timelineWidthPx;
  const mediaDurationSec = Math.max(opts.mediaDurationSec, 0.001);
  const peakDurationSec = Math.max(opts.peakDurationSec, 0.001);
  // Peaks and media duration come from two independent sources (`.dat` decode vs
  // WaveSurfer/HTML media element). For VBR MP3 the browser routinely over-reports
  // duration by a fraction, and there is always sub-second rounding. When peaks
  // effectively cover the whole media (≥ coverage threshold), stretch the columns
  // to fill the entire timeline; otherwise the rightmost whole tiles fall past
  // `peakLayoutSpanPx` and `drawWaveformPeaksTile` no-ops → blank grey tiles on the
  // right (subtle in the full-width overview, but whole empty tiles when zoomed in).
  // Genuinely-short peaks (< threshold, which also triggers regeneration) still clip.
  const coverageRatio = peakDurationSec / mediaDurationSec;
  // When peaks cover the media timeline (≥98%, incl. VBR/rounding drift), stretch columns
  // across the full layout width. Otherwise map peak time onto the media axis so segment
  // positions stay aligned; the tail past peak duration stays empty until peaks regenerate.
  const stretchPeaksToLayout =
    opts.fillLayoutWidth === true ||
    coverageRatio >= PEAKS_MEDIA_MIN_COVERAGE_RATIO;
  const mapDurationSec = stretchPeaksToLayout ? peakDurationSec : mediaDurationSec;
  const peakLayoutSpanPx = stretchPeaksToLayout
    ? layoutWidthPx
    : (peakDurationSec / mapDurationSec) * layoutWidthPx;

  const mid = heightPx / 2;
  const amp = mid * 0.92;

  if (tileLeftPx >= peakLayoutSpanPx) return false;

  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  const tileRightPx = Math.min(peakLayoutSpanPx, tileLeftPx + tileWidthPx);

  const tileStartSec = (tileLeftPx / layoutWidthPx) * mapDurationSec;
  const tileEndSec = (tileRightPx / layoutWidthPx) * mapDurationSec;

  const startCol = Math.max(
    0,
    Math.floor((tileStartSec / peakDurationSec) * totalColumns),
  );
  let endCol = Math.min(
    totalColumns,
    Math.ceil((tileEndSec / peakDurationSec) * totalColumns) + 1,
  );
  if (endCol <= startCol && totalColumns > startCol) {
    endCol = Math.min(totalColumns, startCol + 1);
  }

  // Align to global bar grid so adjacent tiles share column boundaries.
  // In preview≠committed stretch mode startCol may fall off-grid; aligning
  // prevents gaps at tile seams. Columns left of the tile are skipped by
  // the x-bounds check inside the loop.
  const alignedStartCol = Math.floor(startCol / step) * step;

  ctx.fillStyle = waveColor;

  let drewAny = false;
  for (let col = alignedStartCol; col < endCol; col += step) {
    const min = interleavedPeaks[col * 2] ?? 0;
    const max = interleavedPeaks[col * 2 + 1] ?? 0;
    const colTimeSec = (col / totalColumns) * peakDurationSec;
    const colTimelinePx = (colTimeSec / mapDurationSec) * layoutWidthPx;
    const x = colTimelinePx - tileLeftPx;
    if (x + barWidth < 0 || x > tileWidthPx) continue;

    const top = mid - max * amp;
    const bottom = mid - min * amp;
    const y = Math.min(top, bottom);
    const h = Math.max(1, Math.abs(bottom - top));
    ctx.fillRect(x, y, barWidth, h);
    drewAny = true;
  }

  return drewAny;
}
