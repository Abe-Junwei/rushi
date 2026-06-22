/** 语段选中来源（用于行为分支）。 */
export type SegmentSelectSource =
  | "list"
  | "listAdvance"
  | "listKeyboard"
  | "waveform"
  | "waveformKeyboard"
  /** 右键菜单：不 reveal/seek；列表 scroll 仍随 primary。 */
  | "contextMenu"
  /** 列表 range / 波形 lasso 多选：不 reveal/seek；列表 scroll + pin。 */
  | "multiSelect";

export type SegmentDragMode = "resize-start" | "resize-end" | "move" | "create";

export type SegmentSelectAtOptions = {
  shiftKey?: boolean;
  toggle?: boolean;
  /** Waveform pointerdown session that already handled preview seek/reveal. */
  previewSessionId?: string;
  /** listKeyboard burst: SC2 + scroll only; SC1 commit on keyup. */
  burst?: boolean;
};

export function isListKeyboardBurstStep(
  source: SegmentSelectSource,
  opts?: SegmentSelectAtOptions,
): boolean {
  return source === "listKeyboard" && opts?.burst === true && !opts?.shiftKey && !opts?.toggle;
}

/** Waveform arrow keys: SC2 + seek only; SC1 + tier reveal on keyup. */
export function isWaveformKeyboardBurstStep(
  source: SegmentSelectSource,
  opts?: SegmentSelectAtOptions,
): boolean {
  return source === "waveformKeyboard" && !opts?.shiftKey && !opts?.toggle;
}

export function shouldEnterZoomForOverlayGesture(mode: SegmentDragMode): boolean {
  return mode === "resize-start" || mode === "resize-end" || mode === "move";
}

/** 列表/文本编辑选中时不抢 textarea 焦点。 */
export function shouldFocusWaveformShellForSelectSource(source: SegmentSelectSource): boolean {
  return source === "waveform" || source === "waveformKeyboard";
}

/** 仅 waveform 单选：列表行已在视口内时跳过 scroll/pin（SCB-2）。 */
export function shouldSkipListScrollWhenInViewport(source: SegmentSelectSource): boolean {
  return source === "waveform" || source === "waveformKeyboard";
}

/** Store + React subscribers — skip imperative overlay CSP on hot select paths. */
export function shouldSkipImperativeSelectionChrome(source: SegmentSelectSource): boolean {
  return (
    source === "waveform" ||
    source === "waveformKeyboard" ||
    source === "list" ||
    source === "listAdvance" ||
    source === "listKeyboard" ||
    source === "contextMenu" ||
    source === "multiSelect"
  );
}
