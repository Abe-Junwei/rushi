/** Shared px/s constants and timeline width helpers. */

/** 与波形 `minPxPerSec`、时间轨语段卡水平尺度共用 */
export const TIMELINE_PX_PER_SEC = 56;

/** 滑块 / 按钮手动缩放的下限（无媒体上下文时的回退） */
export const PX_PER_SEC_MIN = 16;
/** 跟随语段 fit 可低于手动滑块下限（极长语段缩进视口） */
export const PX_PER_SEC_FIT_MIN = 0.05;
/**
 * 手动 ± / 滑块名义上限（非 fit-selection）。
 * 适度高于旧 400；刻意不对齐 L3（800px/s），避免短音频顶档后过度拉伸。
 */
export const PX_PER_SEC_MAX = 480;
/** 「适配选中语段」可高于手动滑块上限，以便极短语段仍能放进视口 */
export const PX_PER_SEC_FIT_SELECTION_MAX = 1200;

/** 「适配语段」命令：选中语段目标宽度占视口比例 */
export const FIT_SELECTION_VIEWPORT_RATIO = 0.8;

/** peaks resample / ws.load 分档步长：相近 px/s 共享一档，换语段更顺滑。 */
export const PX_PER_SEC_PEAKS_QUANTUM = 8;

/**
 * WaveSurfer 单帧 peaks 列数上限（≈+25% vs 原 32768）。
 * 长音频可渲染 max px/s = 此值 / duration；再大则 resample / canvas 成本明显上升。
 */
export const MAX_WAVESURFER_PEAK_COLUMNS = 40_960;

/** decode 回退路径下单次 canvas 宽度上限（与 peaks 列数上限同比例 ≈+25%）。 */
const MAX_WAVESURFER_CANVAS_WIDTH_PX = 327_680;

/** ± 缩放：从默认 px/s 到 min/max 各需按键次数（对数对称步进）。 */
export const WAVEFORM_ZOOM_STEPS_EACH_WAY = 5;

/** 整段可见「贴满视口」允许的最大右侧留白（px）。 */
export const FIT_ALL_FILL_GAP_MIN_PX = 4;
export const FIT_ALL_FILL_GAP_RATIO = 0.008;

/** 用户显式选择的横向缩放布局意图（非持久偏好）。 */
export type WaveformZoomLayoutIntent = "fit-all" | "fit-selection" | "default" | "manual";

export type WaveformZoomSliderRange = {
  minPxPerSec: number;
  maxPxPerSec: number;
};

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

/** peaks 路径下单帧列数上限对应的 px/s（与 `capWaveformPeakColumns` 一致）。 */
export function resolveMaxPeaksTimelinePxPerSec(durationSec: number): number {
  const sec = Math.max(durationSec, 0.5);
  return MAX_WAVESURFER_PEAK_COLUMNS / sec;
}
