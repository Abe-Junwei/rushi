import type { SegmentDto } from "../tauri/projectTypes";
import type { PeakCache } from "../services/waveform/PeakCache";

/** Options for `useProjectWaveform` (shared to break hook import cycle). */
export type UseProjectWaveformOptions = {
  mediaUrl: string | null;
  segments: SegmentDto[];
  selectedIdx: number;
  disabled?: boolean;
  /** 与 WaveSurfer `minPxPerSec` / tier 对齐的 px/s */
  minPxPerSec?: number;
  /** @deprecated 与 minPxPerSec 相同；保留兼容旧调用方 */
  interactionPxPerSec?: number;
  /** 预计算 peaks（Tauri audiowaveform `.dat`） */
  peakCache?: PeakCache | null;
  /** 缩放滑块拖动中（P2：合并 peaks resample 更新） */
  zoomDragging?: boolean;
  /** peaks resample / ws.zoom 完成后回调（用于 fit 视口 scroll）；返回 true 表示已处理 scroll */
  onZoomApplied?: (pxPerSec: number) => boolean | void;
  /** 波形区纵向高度（px），与外层容器一致；变更时 `setOptions({ height })` */
  waveformHeightPx?: number;
  /** 波形真实重绘完成后，将已应用高度回传给外层预览层。 */
  onWaveformHeightApplied?: (heightPx: number) => void;
  /** 在波形空白处拖选新建语段；启用时会关闭 dragToSeek 以免抢同一套水平拖动 */
  onWaveformCreateRange?: (startSec: number, endSec: number) => void;
  /** 波形内部横向滚动（与外层时间轴滚动条对齐，思路来自解语 waveform ↔ tier scroll sync） */
  onWaveformScroll?: (scrollLeftPx: number) => void;
  /** 当前可见视口横向滚动偏移；若外层容器也参与横向滚动，用于命中换算对齐。 */
  getViewportScrollPx?: () => number;
};
