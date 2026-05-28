/** 语段选中来源（用于行为分支，不再区分总览/精修模式）。 */
export type SegmentSelectSource = "list" | "waveform" | "global-strip";

/** 底部全局波形条（展开时内容区高度）。 */
export const WAVEFORM_GLOBAL_STRIP_HEIGHT_PX = 80;

/** 全局条折叠后的工具栏高度。 */
export const WAVEFORM_GLOBAL_STRIP_COLLAPSED_HEIGHT_PX = 28;

export type SegmentDragMode = "resize-start" | "resize-end" | "move" | "create";

export function shouldEnterZoomForOverlayGesture(mode: SegmentDragMode): boolean {
  return mode === "resize-start" || mode === "resize-end" || mode === "move";
}

/** 列表/文本编辑选中时不抢 textarea 焦点。 */
export function shouldFocusWaveformShellForSelectSource(source: SegmentSelectSource): boolean {
  return source === "waveform" || source === "global-strip";
}
