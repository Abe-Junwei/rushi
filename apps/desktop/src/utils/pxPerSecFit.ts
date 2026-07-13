import {
  clampPxPerSecForFitSelection,
  clampPxPerSecForLayout,
  quantizePxPerSecForPeaksLoad,
} from "./pxPerSecClamp";
import {
  computeTimelineWidthPx,
  FIT_ALL_FILL_GAP_MIN_PX,
  FIT_ALL_FILL_GAP_RATIO,
  FIT_SELECTION_VIEWPORT_RATIO,
  LONG_MEDIA_EDITING_DURATION_SEC,
  LONG_MEDIA_TARGET_SEGMENT_WIDTH_PX,
  LONG_MEDIA_TARGET_VISIBLE_SEC,
  PX_PER_SEC_FIT_MIN,
  PX_PER_SEC_MAX,
  PX_PER_SEC_FIT_SELECTION_MAX,
  TIMELINE_PX_PER_SEC,
  WAVEFORM_ZOOM_STEPS_EACH_WAY,
  type WaveformZoomLayoutIntent,
  type WaveformZoomSliderRange,
} from "./pxPerSecConstants";

export type { WaveformZoomLayoutIntent, WaveformZoomSliderRange };

export type DefaultEditingPxPerSecOptions = {
  /** Packable segment spans (end−start); median drives long-media default when present. */
  segmentSpansSec?: ReadonlyArray<number>;
};

/** Median of positive finite numbers, or null when empty. */
export function medianPositiveNumber(values: ReadonlyArray<number>): number | null {
  const xs = values.filter((v) => Number.isFinite(v) && v > 0).slice().sort((a, b) => a - b);
  if (xs.length === 0) return null;
  const mid = Math.floor(xs.length / 2);
  if (xs.length % 2 === 1) return xs[mid];
  return (xs[mid - 1] + xs[mid]) / 2;
}

/** Stable signature for median-default auto-refit (count + median). */
export function packableSegmentSpansSignature(spans: ReadonlyArray<number>): string {
  const m = medianPositiveNumber(spans);
  if (m == null) return "";
  return `${spans.filter((v) => Number.isFinite(v) && v > 0).length}:${m.toFixed(3)}`;
}

/** 语段 fit 时左右留白（导航时判定「已能放下」用） */
const VIEWPORT_FIT_HORIZONTAL_PADDING_PX = 24;

/**
 * 使 `computeTimelineWidthPx(duration, px)` 不超过视口宽度所需的 px/s（整段可见）。
 * 与底部缩放条最小档位一致。
 */
export function computeFitAllPxPerSec(viewportWidthPx: number, durationSec: number): number {
  const vw = Math.max(1, viewportWidthPx);
  const sec = Math.max(durationSec, 0.5);
  let hi = vw / sec;
  let lo = PX_PER_SEC_FIT_MIN;
  if (computeTimelineWidthPx(sec, hi) <= vw) {
    return clampPxPerSecForFitSelection(hi);
  }
  for (let i = 0; i < 48 && hi - lo > 1e-6; i++) {
    const mid = (lo + hi) / 2;
    if (computeTimelineWidthPx(sec, mid) <= vw) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return clampPxPerSecForFitSelection(lo);
}

/** 给定视口与时长时，手动缩放滑块 [min, max]（min = 整段 fit，max ≥ 默认上限）。 */
export function resolveWaveformZoomSliderRange(
  viewportWidthPx: number,
  durationSec: number,
): WaveformZoomSliderRange {
  const minPxPerSec = computeFitAllPxPerSec(viewportWidthPx, durationSec);
  let maxPxPerSec = Math.max(PX_PER_SEC_MAX, minPxPerSec);
  if (maxPxPerSec <= minPxPerSec) {
    maxPxPerSec = Math.min(PX_PER_SEC_FIT_SELECTION_MAX, minPxPerSec * 1.5);
  }
  // Align slider ceiling with layout soft-cap（非 peaks 列硬顶）so ± steps always change timeline width.
  if (durationSec >= 0.5) {
    const layoutCap = clampPxPerSecForLayout(maxPxPerSec, durationSec);
    maxPxPerSec = Math.max(minPxPerSec, Math.min(maxPxPerSec, layoutCap));
  }
  return { minPxPerSec, maxPxPerSec };
}

/**
 * 当前文件编辑默认 px/s。
 * - 短/中等时长：min/max 几何平均（±5 步各达 fit-all 与手动上限）。
 * - 长音频（≥ {@link LONG_MEDIA_EDITING_DURATION_SEC}）：
 *   - 有 packable 语段跨度 → `TARGET_SEGMENT_WIDTH / median(span)`（路线 D）；
 *   - 否则视口约 {@link LONG_MEDIA_TARGET_VISIBLE_SEC}s。
 * 无视口/时长时回退 TIMELINE_PX_PER_SEC。
 */
export function resolveDefaultEditingPxPerSec(
  viewportWidthPx: number,
  durationSec: number,
  options?: DefaultEditingPxPerSecOptions,
): number {
  if (viewportWidthPx <= 0 || durationSec < 0.5) {
    return TIMELINE_PX_PER_SEC;
  }
  const range = resolveWaveformZoomSliderRange(viewportWidthPx, durationSec);
  if (durationSec >= LONG_MEDIA_EDITING_DURATION_SEC) {
    const medianSpan = medianPositiveNumber(options?.segmentSpansSec ?? []);
    let target: number;
    if (medianSpan != null && medianSpan > 0) {
      target = LONG_MEDIA_TARGET_SEGMENT_WIDTH_PX / medianSpan;
    } else {
      target = viewportWidthPx / LONG_MEDIA_TARGET_VISIBLE_SEC;
    }
    return clampPxPerSecInSliderRange(target, range);
  }
  const geometric = Math.sqrt(range.minPxPerSec * range.maxPxPerSec);
  return clampPxPerSecInSliderRange(geometric, range);
}

/** 给定 slider 区间：使 default×ratio^N=max 且 default÷ratio^N=min 的步进比（N=WAVEFORM_ZOOM_STEPS_EACH_WAY）。 */
export function resolveWaveformZoomStepRatio(range: WaveformZoomSliderRange): number {
  const { minPxPerSec: min, maxPxPerSec: max } = range;
  if (!(min > 0 && max > min * (1 + 1e-9))) {
    return 1.2544000000000002;
  }
  const span = max / min;
  return Math.pow(span, 1 / (2 * WAVEFORM_ZOOM_STEPS_EACH_WAY));
}

/**
 * UI「重置」/ 换文件默认 px/s（per-file；极短音频 min≈max 时即为 fit-all）。
 */
export function resolveDefaultResetPxPerSec(
  viewportWidthPx: number,
  durationSec: number,
  options?: DefaultEditingPxPerSecOptions,
): number {
  return resolveDefaultEditingPxPerSec(viewportWidthPx, durationSec, options);
}

export function clampPxPerSecInSliderRange(
  pxPerSec: number,
  range: WaveformZoomSliderRange,
): number {
  if (!Number.isFinite(pxPerSec)) return range.minPxPerSec;
  return Math.min(range.maxPxPerSec, Math.max(range.minPxPerSec, pxPerSec));
}

/** 当前 px/s 下时间轴是否已不宽于视口（legacy：能放下，不要求贴满）。 */
export function isTimelineFitInViewport(
  viewportWidthPx: number,
  durationSec: number,
  pxPerSec: number,
): boolean {
  const vw = Math.max(1, viewportWidthPx);
  const sec = Math.max(durationSec, 0.5);
  return computeTimelineWidthPx(sec, pxPerSec) <= vw + 0.5;
}

function computeFitAllFillGapPx(
  viewportWidthPx: number,
  durationSec: number,
  pxPerSec: number,
): number {
  const vw = Math.max(1, viewportWidthPx);
  const sec = Math.max(durationSec, 0.5);
  return vw - computeTimelineWidthPx(sec, pxPerSec);
}

/** 整段可见不变量：timeline 宽度应贴满 tier 视口（允许 ceil 造成的 ≤0.5px 溢出）。 */
export function isFitAllTimelineFilledInViewport(
  viewportWidthPx: number,
  durationSec: number,
  pxPerSec: number,
): boolean {
  if (viewportWidthPx <= 0 || durationSec <= 0 || !Number.isFinite(pxPerSec)) {
    return false;
  }
  const gap = computeFitAllFillGapPx(viewportWidthPx, durationSec, pxPerSec);
  const threshold = Math.max(
    FIT_ALL_FILL_GAP_MIN_PX,
    viewportWidthPx * FIT_ALL_FILL_GAP_RATIO,
  );
  return gap >= -0.5 && gap <= threshold;
}

function fitSelectionViewportWidthPx(viewportWidthPx: number): number {
  return Math.max(160, Math.max(1, viewportWidthPx) - VIEWPORT_FIT_HORIZONTAL_PADDING_PX);
}

/** 「适配语段」目标宽度：视口宽度的 80%（极窄视口仍保留最小可读宽度）。 */
function fitSelectionTargetWidthPx(viewportWidthPx: number): number {
  const vw = Math.max(1, viewportWidthPx);
  return Math.max(160, vw * FIT_SELECTION_VIEWPORT_RATIO);
}

/** 将选中语段缩放到占视口 80% 宽度所需的 px/s（可放大或缩小）。 */
export function computeFitSelectionPxPerSec(
  viewportWidthPx: number,
  startSec: number,
  endSec: number,
): number {
  const span = Math.max(endSec - startSec, 0.05);
  const targetWidthPx = fitSelectionTargetWidthPx(viewportWidthPx);
  return clampPxPerSecForFitSelection(targetWidthPx / span);
}

/** 语段 fit 命令实际写入 WaveSurfer 的量化 px/s（与 queueViewportFit 一致）。 */
export function resolveQuantizedFitSelectionPxPerSec(
  viewportWidthPx: number,
  startSec: number,
  endSec: number,
): number {
  return quantizePxPerSecForPeaksLoad(
    computeFitSelectionPxPerSec(viewportWidthPx, startSec, endSec),
  );
}

/** viewport fit 最终 layout px/s：peaks 量化 + layout soft-cap（与 timeline clamp 一致）。 */
export function resolveViewportFitLayoutPxPerSec(
  pxPerSec: number,
  durationSec: number,
): number {
  return clampPxPerSecForLayout(
    quantizePxPerSecForPeaksLoad(pxPerSec),
    durationSec,
  );
}

/**
 * 切换语段时的目标 px/s：当前缩放已能放下语段则保持不变（仅滚 tier），
 * 否则缩小到能容纳。避免准星模式下每次切换都 peaks resample + ws.load。
 */
export function resolveSelectionFitPxPerSec(
  viewportWidthPx: number,
  startSec: number,
  endSec: number,
  currentPxPerSec: number,
): number {
  const vw = fitSelectionViewportWidthPx(viewportWidthPx);
  const span = Math.max(endSec - startSec, 0.05);
  const current = clampPxPerSecForFitSelection(currentPxPerSec);
  if (span * current <= vw) {
    return current;
  }
  return quantizePxPerSecForPeaksLoad(
    computeFitSelectionPxPerSec(viewportWidthPx, startSec, endSec),
  );
}

/** 使语段在视口中居中（或贴边钳制）的 tier scrollLeft。 */
export function computeSelectionFitScrollPx(input: {
  viewportWidthPx: number;
  timelineWidthPx: number;
  durationSec: number;
  startSec: number;
  endSec: number;
}): number {
  const vw = Math.max(1, input.viewportWidthPx);
  const tw = Math.max(1, input.timelineWidthPx);
  const dur = Math.max(input.durationSec, 0.001);
  const maxSl = Math.max(0, tw - vw);
  const span = Math.max(input.endSec - input.startSec, 0.05);
  const segStartPx = (input.startSec / dur) * tw;
  const segWidthPx = (span / dur) * tw;
  const targetSl = segStartPx - (vw - segWidthPx) / 2;
  return Math.max(0, Math.min(maxSl, targetSl));
}

export type ViewportFitScrollIntent = {
  startSec: number;
  endSec: number;
};

export function computeViewportFitScrollPx(input: {
  intent: ViewportFitScrollIntent;
  viewportWidthPx: number;
  timelineWidthPx: number;
  durationSec: number;
}): number {
  return computeSelectionFitScrollPx({
    viewportWidthPx: input.viewportWidthPx,
    timelineWidthPx: input.timelineWidthPx,
    durationSec: input.durationSec,
    startSec: input.intent.startSec,
    endSec: input.intent.endSec,
  });
}
