/** 语段选中来源（用于行为分支）。 */
export type SegmentSelectSource =
  | "list"
  | "listAdvance"
  | "listKeyboard"
  | "waveform"
  /** 右键菜单：不 reveal/seek；列表 scroll 仍随 primary。 */
  | "contextMenu"
  /** 列表 range / 波形 lasso 多选：不 reveal/seek；列表 scroll + pin。 */
  | "multiSelect";

export type SegmentDragMode = "resize-start" | "resize-end" | "move" | "create";

export type SegmentSelectAtOptions = {
  shiftKey?: boolean;
  toggle?: boolean;
  /** listKeyboard burst: SC2 + scroll only; SC1 commit on keyup. */
  burst?: boolean;
};

export function shouldEnterZoomForOverlayGesture(mode: SegmentDragMode): boolean {
  return mode === "resize-start" || mode === "resize-end" || mode === "move";
}

/** 列表/文本编辑选中时不抢 textarea 焦点。 */
export function shouldFocusWaveformShellForSelectSource(source: SegmentSelectSource): boolean {
  return source === "waveform";
}

/** 仅 waveform 单选：列表行已在视口内时跳过 scroll/pin（SCB-2）。 */
export function shouldSkipListScrollWhenInViewport(source: SegmentSelectSource): boolean {
  return source === "waveform";
}
