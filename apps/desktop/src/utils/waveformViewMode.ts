/** 语段选中来源（用于行为分支）。 */
export type SegmentSelectSource = "list" | "waveform";

export type SegmentDragMode = "resize-start" | "resize-end" | "move" | "create";

export function shouldEnterZoomForOverlayGesture(mode: SegmentDragMode): boolean {
  return mode === "resize-start" || mode === "resize-end" || mode === "move";
}

/** 列表选中时缩进视口以容纳语段；波形内点击仅滚动，不改变缩放。 */
export function shouldZoomViewportOnSelectSource(source: SegmentSelectSource): boolean {
  return source === "list";
}

/** 列表/文本编辑选中时不抢 textarea 焦点。 */
export function shouldFocusWaveformShellForSelectSource(source: SegmentSelectSource): boolean {
  return source === "waveform";
}
