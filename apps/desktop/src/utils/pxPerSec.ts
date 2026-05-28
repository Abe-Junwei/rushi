/** 与波形 `minPxPerSec`、时间轨语段卡水平尺度共用 */
export const TIMELINE_PX_PER_SEC = 56;

/** 滑块 / 按钮手动缩放的下限（无媒体上下文时的回退） */
export const PX_PER_SEC_MIN = 16;
/** 跟随语段 fit 可低于手动滑块下限（极长语段缩进视口） */
export const PX_PER_SEC_FIT_MIN = 0.05;
export const PX_PER_SEC_MAX = 400;
/** 「适配选中语段」可高于手动滑块上限，以便极短语段仍能放进视口 */
export const PX_PER_SEC_FIT_SELECTION_MAX = 1200;

/** 语段 fit 时左右留白（与 `fitSelectionViewportWidthPx` 一致） */
export const VIEWPORT_FIT_HORIZONTAL_PADDING_PX = 24;

/**
 * 时间轴总宽 = 媒体时长 × 像素/秒（与 WaveSurfer `minPxPerSec` 一致）。
 * 若与波形可滚宽度不一致，会导致 tier 与波形横向错位、语段卡与 region 对不齐。
 */
export function computeTimelineWidthPx(durationSec: number, pxPerSec: number): number {
  const floor = 320;
  const sec = Math.max(durationSec, 0.5);
  return Math.max(Math.ceil(sec * pxPerSec), floor);
}

/** peaks resample / ws.load 分档步长：相近 px/s 共享一档，换语段更顺滑。 */
export const PX_PER_SEC_PEAKS_QUANTUM = 8;

export function clampPxPerSec(x: number): number {
  if (!Number.isFinite(x)) return TIMELINE_PX_PER_SEC;
  return Math.min(PX_PER_SEC_MAX, Math.max(PX_PER_SEC_FIT_MIN, x));
}

/** 滑块与 +/- 按钮：不低于手动下限 */
export function clampPxPerSecForSlider(x: number): number {
  if (!Number.isFinite(x)) return TIMELINE_PX_PER_SEC;
  return Math.min(PX_PER_SEC_MAX, Math.max(PX_PER_SEC_MIN, x));
}

export type WaveformZoomSliderRange = {
  minPxPerSec: number;
  maxPxPerSec: number;
};

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
  return { minPxPerSec, maxPxPerSec };
}

export function clampPxPerSecInSliderRange(
  pxPerSec: number,
  range: WaveformZoomSliderRange,
): number {
  if (!Number.isFinite(pxPerSec)) return range.minPxPerSec;
  return Math.min(range.maxPxPerSec, Math.max(range.minPxPerSec, pxPerSec));
}

/** 当前 px/s 下时间轴是否已不宽于视口（用于判定「整段可见」）。 */
export function isTimelineFitInViewport(
  viewportWidthPx: number,
  durationSec: number,
  pxPerSec: number,
): boolean {
  const vw = Math.max(1, viewportWidthPx);
  const sec = Math.max(durationSec, 0.5);
  return computeTimelineWidthPx(sec, pxPerSec) <= vw + 0.5;
}

export function fitSelectionViewportWidthPx(viewportWidthPx: number): number {
  return Math.max(160, Math.max(1, viewportWidthPx) - VIEWPORT_FIT_HORIZONTAL_PADDING_PX);
}

function clampPxPerSecForFitSelection(x: number): number {
  if (!Number.isFinite(x)) return TIMELINE_PX_PER_SEC;
  return Math.min(PX_PER_SEC_FIT_SELECTION_MAX, Math.max(PX_PER_SEC_FIT_MIN, x));
}

/** 将 fit 目标 px/s 量化到分档，减少语段切换时的 peaks reload。手动滑块不经过此函数。 */
export function quantizePxPerSecForPeaksLoad(pxPerSec: number): number {
  if (!Number.isFinite(pxPerSec)) return TIMELINE_PX_PER_SEC;
  const clamped = clampPxPerSecForFitSelection(pxPerSec);
  const q = PX_PER_SEC_PEAKS_QUANTUM;
  let snapped = Math.round(clamped / q) * q;
  if (snapped < PX_PER_SEC_FIT_MIN) {
    snapped = PX_PER_SEC_FIT_MIN;
  }
  if (snapped >= PX_PER_SEC_MIN) {
    return Math.min(PX_PER_SEC_MAX, Math.max(PX_PER_SEC_MIN, snapped));
  }
  return clampPxPerSecForFitSelection(snapped);
}

/** 将选中语段缩进视口可用宽度所需的 px/s。 */
export function computeFitSelectionPxPerSec(
  viewportWidthPx: number,
  startSec: number,
  endSec: number,
): number {
  const span = Math.max(endSec - startSec, 0.05);
  const vw = fitSelectionViewportWidthPx(viewportWidthPx);
  return clampPxPerSecForFitSelection(vw / span);
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
  pxPerSec: number;
  startSec: number;
  endSec: number;
}): number {
  const vw = Math.max(1, input.viewportWidthPx);
  const maxSl = Math.max(0, input.timelineWidthPx - vw);
  const span = Math.max(input.endSec - input.startSec, 0.05);
  const segStartPx = input.startSec * input.pxPerSec;
  const segWidthPx = span * input.pxPerSec;
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
  pxPerSec: number;
}): number {
  return computeSelectionFitScrollPx({
    viewportWidthPx: input.viewportWidthPx,
    timelineWidthPx: input.timelineWidthPx,
    pxPerSec: input.pxPerSec,
    startSec: input.intent.startSec,
    endSec: input.intent.endSec,
  });
}
