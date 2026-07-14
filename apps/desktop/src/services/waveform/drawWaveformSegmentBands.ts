import type { SegmentDto } from "../../tauri/projectApi";
import { paddedVisibleTimeWindow, timeToTimelinePx } from "../../utils/waveformProjection";
import {
  WAVEFORM_SEGMENT_INSET_BOTTOM_PX,
  WAVEFORM_SEGMENT_INSET_TOP_PX,
} from "../../utils/waveformSegmentBounds";
import {
  readWaveformSegmentBandPalette,
  segmentBandFillStyle,
} from "../../utils/waveformSegmentBandCanvasColors";
import type { WaveformSegmentBandPalette } from "../../utils/waveformThemeColors";
import { resolveWaveformSegmentFillState } from "../../utils/segmentChrome";

const SEGMENT_BAND_VIEWPORT_PAD_MUL = 1.5;
const SEGMENT_BAND_INDEX_SCAN_THRESHOLD = 200;

export type DrawWaveformSegmentBandsInput = {
  ctx: CanvasRenderingContext2D;
  segments: SegmentDto[];
  dominantSpanIndices?: readonly number[];
  dominantSpanSet?: ReadonlySet<number>;
  scrollLeftPx: number;
  viewportWidthPx: number;
  timelineWidthPx: number;
  durationSec: number;
  layoutHeightPx: number;
  selectedIdx?: number;
  selectedIndices?: ReadonlySet<number>;
  selectionLo?: number;
  selectionHi?: number;
  selectionCount?: number;
  playheadSec?: number;
  skipIndices?: readonly number[];
  skipIndexSet?: ReadonlySet<number>;
  /**
   * When set (list filter active), indices not in this set are not filled
   * (same as skip — clears on dirtyOnly so stale idle pixels do not linger).
   */
  listVisibleIndexSet?: ReadonlySet<number> | null;
  /** When set, only clear/redraw these indices (plus neighbors already expanded by caller). */
  dirtyIndices?: readonly number[];
  palette?: WaveformSegmentBandPalette;
};

/** First index whose end >= windowStart (segments sorted by start_sec). */
export function findFirstSegmentIndexEndingAtOrAfter(
  segments: readonly { start_sec: number; end_sec: number }[],
  windowStartSec: number,
): number {
  let lo = 0;
  let hi = segments.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const seg = segments[mid];
    const end = Math.max(seg.start_sec, seg.end_sec);
    if (end < windowStartSec) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Last index whose start <= windowEnd (segments sorted by start_sec). */
export function findLastSegmentIndexStartingAtOrBefore(
  segments: readonly { start_sec: number; end_sec: number }[],
  windowEndSec: number,
): number {
  let lo = 0;
  let hi = segments.length - 1;
  let last = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const seg = segments[mid];
    const start = Math.min(seg.start_sec, seg.end_sec);
    if (start <= windowEndSec) {
      last = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return last;
}

type BandGeom = {
  idx: number;
  leftViewportPx: number;
  bandWidthPx: number;
  selected: boolean;
  inSelection: boolean;
  multiSelectActive: boolean;
};

/** Diagonal hatch overlay for frozen segments (matches CM `.cm-transcript-frozen-line`). */
function paintFrozenBandHatch(
  ctx: CanvasRenderingContext2D,
  left: number,
  top: number,
  width: number,
  height: number,
  palette: WaveformSegmentBandPalette,
): void {
  if (!(width > 0) || !(height > 0)) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(left, top, width, height);
  ctx.clip();
  ctx.strokeStyle = palette.selectedBorder;
  // Soft accent hatch — low alpha so body/peaks stay readable.
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 1;
  const step = 8;
  const x0 = left - height;
  const x1 = left + width + height;
  for (let x = x0; x < x1; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, top + height);
    ctx.lineTo(x + height, top);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawWaveformSegmentBands(input: DrawWaveformSegmentBandsInput): void {
  const {
    ctx,
    segments,
    scrollLeftPx,
    viewportWidthPx,
    timelineWidthPx,
    durationSec,
    layoutHeightPx,
    selectedIdx = -1,
    selectedIndices,
    selectionLo,
    selectionHi,
    selectionCount,
    playheadSec,
    dirtyIndices,
  } = input;
  const widthPx = Math.max(1, Math.floor(viewportWidthPx));
  const heightPx = Math.max(1, Math.floor(layoutHeightPx));
  const dirtyOnly = dirtyIndices != null && dirtyIndices.length > 0;
  if (!dirtyOnly) ctx.clearRect(0, 0, widthPx, heightPx);

  if (segments.length === 0 || durationSec <= 0 || timelineWidthPx <= 0) return;

  const timeWindow = paddedVisibleTimeWindow(
    {
      scrollLeftPx,
      viewportWidthPx,
      timelineWidthPx,
      durationSec,
    },
    SEGMENT_BAND_VIEWPORT_PAD_MUL,
  );

  const insetTop = WAVEFORM_SEGMENT_INSET_TOP_PX;
  const bandHeight = Math.max(20, heightPx - insetTop - WAVEFORM_SEGMENT_INSET_BOTTOM_PX);
  const palette = input.palette ?? readWaveformSegmentBandPalette();
  const dominant = input.dominantSpanSet ?? new Set(input.dominantSpanIndices ?? []);
  const skip = input.skipIndexSet ?? new Set(input.skipIndices ?? []);
  const listVisible = input.listVisibleIndexSet ?? null;

  const resolveGeom = (idx: number): BandGeom | null => {
    const seg = segments[idx];
    if (!seg) return null;
    const lo = Math.min(seg.start_sec, seg.end_sec);
    const hi = Math.max(seg.start_sec, seg.end_sec);
    if (hi < timeWindow.start || lo > timeWindow.end) return null;

    const leftTimelinePx = timeToTimelinePx(lo, timelineWidthPx, durationSec);
    const rightTimelinePx = timeToTimelinePx(hi, timelineWidthPx, durationSec);
    const bandWidthPx = Math.max(2, rightTimelinePx - leftTimelinePx);
    const leftViewportPx = leftTimelinePx - scrollLeftPx;
    if (leftViewportPx + bandWidthPx < 0 || leftViewportPx > widthPx) return null;

    const { selected, inSelection, multiSelectActive } = resolveWaveformSegmentFillState({
      idx,
      selectedIdx,
      selectedIndices,
      selectionLo,
      selectionHi,
      selectionCount,
    });
    return { idx, leftViewportPx, bandWidthPx, selected, inSelection, multiSelectActive };
  };

  const clearDirtyBand = (geom: BandGeom) => {
    // Dirty-rect must clear even when DOM overlay owns the band (skip/dominant).
    // Otherwise idle pixels remain under the translucent selected overlay and the
    // same segment looks split-tone (idle+selected vs selected-only).
    ctx.clearRect(geom.leftViewportPx, 0, geom.bandWidthPx, heightPx);
  };

  const fillBand = (geom: BandGeom) => {
    const { idx, leftViewportPx, bandWidthPx, selected, inSelection, multiSelectActive } = geom;
    const seg = segments[idx];
    if (!seg) return;
    if (dominant.has(idx) || skip.has(idx)) {
      // `skip` indices always have an interactive DOM overlay node that renders the
      // frozen hatch via CSS (.waveform-segment-region-frozen); painting it here too
      // would double-hatch. Only dominant spans without a DOM node need the canvas
      // hatch so the selection wash does not erase the freeze cue.
      if (seg.frozen && !skip.has(idx)) {
        paintFrozenBandHatch(ctx, leftViewportPx, insetTop, bandWidthPx, bandHeight, palette);
      }
      return;
    }
    if (listVisible && !listVisible.has(idx)) return;
    ctx.fillStyle = segmentBandFillStyle(seg, selected, playheadSec, palette, {
      inSelection,
      multiSelectActive,
    });
    ctx.fillRect(leftViewportPx, insetTop, bandWidthPx, bandHeight);
    if (seg.frozen) {
      paintFrozenBandHatch(ctx, leftViewportPx, insetTop, bandWidthPx, bandHeight, palette);
    }
  };

  const canPaintCanvasBand = (idx: number): boolean => {
    if (dominant.has(idx) || skip.has(idx)) return false;
    if (listVisible && !listVisible.has(idx)) return false;
    return Boolean(segments[idx]);
  };

  const paintSeparatorAt = (edgePx: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(edgePx) - 1, insetTop, 1, bandHeight);
  };

  const paintBandSeparators = (geom: BandGeom) => {
    const { idx, leftViewportPx, bandWidthPx } = geom;
    if (!canPaintCanvasBand(idx)) return;

    // Canvas separators stay structural and solid; low-confidence styling is a
    // DOM-overlay affordance (dashed borders) when the segment is interactive.
    // Drawn in a second pass so the next abutting band's fill cannot cover them.
    // Use integer-pixel fills instead of stroke: segment boundaries often land
    // on fractional timeline pixels, where a stroked 1px line gets antialiased
    // enough to disappear against same-color adjacent fills.
    // Trial: no selected/in-selection border chrome — structural border only.
    const color = palette.border;

    if (idx > 0 && !canPaintCanvasBand(idx - 1)) {
      paintSeparatorAt(leftViewportPx, color);
    }
    paintSeparatorAt(leftViewportPx + bandWidthPx, color);
  };

  const paintIndices = (indices: Iterable<number>) => {
    const geoms: BandGeom[] = [];
    for (const idx of indices) {
      const geom = resolveGeom(idx);
      if (!geom) continue;
      if (dirtyOnly) clearDirtyBand(geom);
      geoms.push(geom);
    }
    // Two-pass: fills first, then separators. Abutting segments (end==next.start)
    // would otherwise have the next fillRect cover the previous right-edge stroke.
    for (const geom of geoms) fillBand(geom);
    for (const geom of geoms) paintBandSeparators(geom);
  };

  if (dirtyOnly) {
    paintIndices(dirtyIndices);
    return;
  }

  const useIndexWindow = segments.length >= SEGMENT_BAND_INDEX_SCAN_THRESHOLD;
  const indexFrom = useIndexWindow
    ? findFirstSegmentIndexEndingAtOrAfter(segments, timeWindow.start)
    : 0;
  const indexTo = useIndexWindow
    ? findLastSegmentIndexStartingAtOrBefore(segments, timeWindow.end)
    : segments.length - 1;

  if (indexTo < indexFrom) return;

  const indices: number[] = [];
  for (let idx = indexFrom; idx <= indexTo; idx += 1) indices.push(idx);
  paintIndices(indices);
}
