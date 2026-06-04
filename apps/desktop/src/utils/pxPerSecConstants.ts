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

/** 整段可见「贴满视口」允许的最大右侧留白（px）。 */
export const FIT_ALL_FILL_GAP_MIN_PX = 4;
export const FIT_ALL_FILL_GAP_RATIO = 0.008;

export type WaveformZoomSliderRange = {
  minPxPerSec: number;
  maxPxPerSec: number;
};

/** 用户显式选择的横向缩放布局意图（非持久偏好）。 */
export type WaveformZoomLayoutIntent = "fit-all" | "fit-selection" | "default" | "manual";

export type ViewportFitScrollIntent = {
  startSec: number;
  endSec: number;
};
