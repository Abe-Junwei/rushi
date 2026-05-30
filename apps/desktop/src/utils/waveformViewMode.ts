import type { WaveformZoomLayoutIntent } from "./pxPerSec";

/** 语段选中来源（用于行为分支）。 */
export type SegmentSelectSource = "list" | "waveform";

export type SegmentDragMode = "resize-start" | "resize-end" | "move" | "create";

export function shouldEnterZoomForOverlayGesture(mode: SegmentDragMode): boolean {
  return mode === "resize-start" || mode === "resize-end" || mode === "move";
}

/** 列表选中时缩进视口以容纳语段；波形内点击默认仅滚动，语段适配模式下会 re-fit。 */
export function shouldZoomViewportOnSelectSource(source: SegmentSelectSource): boolean {
  return source === "list";
}

/** 语段适配模式（layoutIntent=fit-selection）下，波形点选换语段应继续 fit 新语段。 */
export function shouldFitSelectionOnWaveformSelect(
  source: SegmentSelectSource,
  layoutIntent: WaveformZoomLayoutIntent,
): boolean {
  return source === "waveform" && layoutIntent === "fit-selection";
}

/** 列表/文本编辑选中时不抢 textarea 焦点。 */
export function shouldFocusWaveformShellForSelectSource(source: SegmentSelectSource): boolean {
  return source === "waveform";
}
