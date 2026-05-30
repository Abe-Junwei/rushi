/** 与波形 `minPxPerSec`、时间轨语段卡水平尺度共用 */
export const TIMELINE_PX_PER_SEC = 56;

/** 滑块 / 按钮手动缩放的下限（无媒体上下文时的回退） */
export const PX_PER_SEC_MIN = 16;
/** 跟随语段 fit 可低于手动滑块下限（极长语段缩进视口） */
export const PX_PER_SEC_FIT_MIN = 0.05;
export const PX_PER_SEC_MAX = 400;
/** 「适配选中语段」可高于手动滑块上限，以便极短语段仍能放进视口 */
export const PX_PER_SEC_FIT_SELECTION_MAX = 1200;

/** 语段 fit 时左右留白（导航时判定「已能放下」用） */
export const VIEWPORT_FIT_HORIZONTAL_PADDING_PX = 24;

/** 「适配语段」命令：选中语段目标宽度占视口比例 */
export const FIT_SELECTION_VIEWPORT_RATIO = 0.8;

/**
 * 时间轴总宽 = 媒体时长 × 像素/秒（与 WaveSurfer `minPxPerSec` 一致）。
 * 若与波形可滚宽度不一致，会导致 tier 与波形横向错位、语段卡与 region 对不齐。
 */
export function computeTimelineWidthPx(
  durationSec: number,
  pxPerSec: number,
  minWidthPx?: number,
): number {
  const sec = Math.max(durationSec, 0.5);
  const w = Math.ceil(sec * pxPerSec);
  if (minWidthPx != null && minWidthPx > 0) {
    return Math.max(w, minWidthPx);
  }
  return w;
}

/** peaks resample / ws.load 分档步长：相近 px/s 共享一档，换语段更顺滑。 */
export const PX_PER_SEC_PEAKS_QUANTUM = 8;

/** WaveSurfer 单帧 peaks 列数上限；超长音频高缩放时避免百万列 resample / 主线程卡顿。 */
export const MAX_WAVESURFER_PEAK_COLUMNS = 32_768;

/** decode 回退路径下单次 canvas 宽度上限（与 peaks 列数上限配套）。 */
export const MAX_WAVESURFER_CANVAS_WIDTH_PX = 262_144;

/** 超过此时长，打开文件默认「整段可见」而非 56 px/s。 */
export const LONG_MEDIA_OPEN_FIT_ALL_SEC = 30 * 60;

/** ± 缩放：从默认 px/s 到 min/max 各需按键次数（对数对称步进）。 */
export const WAVEFORM_ZOOM_STEPS_EACH_WAY = 5;

export function capWaveformPeakColumns(timelineWidthPx: number): number {
  const w = Math.floor(timelineWidthPx);
  if (!Number.isFinite(w) || w <= 0) return 1;
  return Math.min(w, MAX_WAVESURFER_PEAK_COLUMNS);
}

/** 超长媒体在 decode 路径下可渲染的最大 px/s（避免 duration×px/s 超大 canvas）。 */
export function resolveMaxRenderablePxPerSec(durationSec: number): number {
  const sec = Math.max(durationSec, 0.5);
  return MAX_WAVESURFER_CANVAS_WIDTH_PX / sec;
}

export function clampPxPerSecForWaveSurferRender(pxPerSec: number, durationSec: number): number {
  const capped = Math.min(pxPerSec, resolveMaxRenderablePxPerSec(durationSec));
  return clampPxPerSecForFitSelection(capped);
}

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

/**
 * 当前文件编辑默认 px/s：min/max 几何平均，±5 步各达 fit-all 与手动上限。
 * 无视口/时长时回退 TIMELINE_PX_PER_SEC。
 */
export function resolveDefaultEditingPxPerSec(
  viewportWidthPx: number,
  durationSec: number,
): number {
  if (viewportWidthPx <= 0 || durationSec < 0.5) {
    return TIMELINE_PX_PER_SEC;
  }
  const range = resolveWaveformZoomSliderRange(viewportWidthPx, durationSec);
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
 * UI「重置」/ 换文件默认 px/s（per-file 几何默认；极短音频 min≈max 时即为 fit-all）。
 */
export function resolveDefaultResetPxPerSec(
  viewportWidthPx: number,
  durationSec: number,
): number {
  return resolveDefaultEditingPxPerSec(viewportWidthPx, durationSec);
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

/** 整段可见「贴满视口」允许的最大右侧留白（px）。 */
export const FIT_ALL_FILL_GAP_MIN_PX = 4;
export const FIT_ALL_FILL_GAP_RATIO = 0.008;

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

export function computeFitAllFillGapPx(
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

/** 用户显式选择的横向缩放布局意图（非持久偏好）。 */
export type WaveformZoomLayoutIntent = "fit-all" | "fit-selection" | "default" | "manual";

export function fitSelectionViewportWidthPx(viewportWidthPx: number): number {
  return Math.max(160, Math.max(1, viewportWidthPx) - VIEWPORT_FIT_HORIZONTAL_PADDING_PX);
}

/** 「适配语段」目标宽度：视口宽度的 80%（极窄视口仍保留最小可读宽度）。 */
export function fitSelectionTargetWidthPx(viewportWidthPx: number): number {
  const vw = Math.max(1, viewportWidthPx);
  return Math.max(160, vw * FIT_SELECTION_VIEWPORT_RATIO);
}

export function clampPxPerSecForFitSelection(x: number): number {
  if (!Number.isFinite(x)) return TIMELINE_PX_PER_SEC;
  return Math.min(PX_PER_SEC_FIT_SELECTION_MAX, Math.max(PX_PER_SEC_FIT_MIN, x));
}

/** 将 px/s 量化到分档，减少 peaks resample + ws.load（fit 与缩放滑块共用）。 */
export function quantizePxPerSecForPeaksLoad(pxPerSec: number): number {
  if (!Number.isFinite(pxPerSec)) return TIMELINE_PX_PER_SEC;
  const clamped = clampPxPerSecForFitSelection(pxPerSec);
  const q = PX_PER_SEC_PEAKS_QUANTUM;
  let snapped = Math.round(clamped / q) * q;
  if (clamped < PX_PER_SEC_MIN) {
    // 8 px/s quantum rounds sub-manual values (e.g. 0.2, fit-all 0.67) to 0.
    if (snapped <= 0) {
      return clamped;
    }
    return clampPxPerSecForFitSelection(snapped);
  }
  if (snapped < PX_PER_SEC_FIT_MIN) {
    snapped = PX_PER_SEC_FIT_MIN;
  }
  if (snapped >= PX_PER_SEC_MIN) {
    // Fit-selection may exceed the manual slider ceiling so very short segments
    // can fill the viewport; cap at the fit-selection max, not the manual max.
    return Math.min(PX_PER_SEC_FIT_SELECTION_MAX, Math.max(PX_PER_SEC_MIN, snapped));
  }
  return clampPxPerSecForFitSelection(snapped);
}

/**
 * Ultra-zoomed fit-all (px/s below manual slider min): peaks LOD is already sparse;
 * viewport refit / fullscreen should ws.zoom only — not ws.load per exact px/s.
 */
export function shouldZoomOnlyForSubMinFitAllPeaks(
  loadedPeaksPxPerSec: number,
  requestedPeaksPxPerSec: number,
): boolean {
  if (!Number.isFinite(loadedPeaksPxPerSec) || loadedPeaksPxPerSec <= 0) return false;
  if (loadedPeaksPxPerSec >= PX_PER_SEC_MIN) return false;
  return requestedPeaksPxPerSec < PX_PER_SEC_MIN;
}

/** Sub-min fit-all refit: zoom in place — skip ws.load on viewport px/s drift or in-flight peaks. */
export function shouldZoomOnlyForSubMinFitAllRefit(input: {
  requestedPeaksPxPerSec: number;
  loadedPeaksPxPerSec: number;
  peaksLoadedIntoWaveSurfer: boolean;
  peaksLoadInFlight: boolean;
}): boolean {
  const {
    requestedPeaksPxPerSec,
    loadedPeaksPxPerSec,
    peaksLoadedIntoWaveSurfer,
    peaksLoadInFlight,
  } = input;
  if (requestedPeaksPxPerSec >= PX_PER_SEC_MIN) return false;
  if (peaksLoadInFlight) return true;
  if (
    peaksLoadedIntoWaveSurfer &&
    shouldZoomOnlyForSubMinFitAllPeaks(loadedPeaksPxPerSec, requestedPeaksPxPerSec)
  ) {
    return true;
  }
  return false;
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

/** viewport fit 最终 layout px/s：peaks 量化 + WaveSurfer 渲染上限（与 timeline clamp 一致）。 */
export function resolveViewportFitLayoutPxPerSec(
  pxPerSec: number,
  durationSec: number,
): number {
  return clampPxPerSecForWaveSurferRender(
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
