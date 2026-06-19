/** 语段选中来源（用于行为分支）。 */
export type SegmentSelectSource = "list" | "listAdvance" | "listKeyboard" | "waveform";

export type SegmentDragMode = "resize-start" | "resize-end" | "move" | "create";

export function shouldEnterZoomForOverlayGesture(mode: SegmentDragMode): boolean {
  return mode === "resize-start" || mode === "resize-end" || mode === "move";
}

/** 列表/文本编辑选中时不抢 textarea 焦点。 */
export function shouldFocusWaveformShellForSelectSource(source: SegmentSelectSource): boolean {
  return source === "waveform";
}
