import type { SegmentDto } from "../tauri/projectTypes";

/** Options for `useProjectWaveform` (shared to break hook import cycle). */
export type UseProjectWaveformOptions = {
  mediaUrl: string | null;
  segments: SegmentDto[];
  selectedIdx: number;
  disabled?: boolean;
  /** 与 WaveSurfer `minPxPerSec` 对齐的渲染 px/s */
  minPxPerSec?: number;
  /** 与 tier / ruler 对齐的交互 px/s（预览期可与 minPxPerSec 不同） */
  interactionPxPerSec?: number;
  /** 波形区纵向高度（px），与外层容器一致；变更时 `setOptions({ height })` */
  waveformHeightPx?: number;
  /** 波形真实重绘完成后，将已应用高度回传给外层预览层。 */
  onWaveformHeightApplied?: (heightPx: number) => void;
  onSelectIndex: (idx: number) => void;
  /** Single undo entry: segment time bounds after drag/resize. */
  onBoundsCommit: (idx: number, startSec: number, endSec: number) => void;
  /** 在波形空白处拖选新建语段；启用时会关闭 dragToSeek 以免抢同一套水平拖动 */
  onWaveformCreateRange?: (startSec: number, endSec: number) => void;
  /** 波形内部横向滚动（与外层时间轴滚动条对齐，思路来自解语 waveform ↔ tier scroll sync） */
  onWaveformScroll?: (scrollLeftPx: number) => void;
  /** 当前可见视口横向滚动偏移；若外层容器也参与横向滚动，用于命中换算对齐。 */
  getViewportScrollPx?: () => number;
};
