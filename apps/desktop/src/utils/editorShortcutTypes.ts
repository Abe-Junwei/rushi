export type EditorShortcutScope = "global" | "waveform";

export type EditorShortcutId =
  | "segment.mergeNext"
  | "segment.mergePrev"
  | "segment.advancePrev"
  | "segment.advanceNext"
  | "segment.splitPlayhead"
  | "segment.focusText"
  | "segment.delete"
  | "playback.toggle"
  | "edit.undo"
  | "edit.redo"
  | "workflow.save"
  | "workflow.confirmAdvance"
  | "workflow.find"
  | "workflow.closeFile"
  | "workflow.openSettings"
  | "workflow.openActivityInbox"
  | "workflow.segmentAnnotation"
  | "workflow.addCorrectionMemory"
  | "waveform.clearSelection"
  | "waveform.selectSegmentPrev"
  | "waveform.selectSegmentNext"
  | "waveform.seekFramePrev"
  | "waveform.seekFrameNext"
  | "waveform.zoomIn"
  | "waveform.zoomOut"
  | "waveform.lowConfidencePrev"
  | "waveform.lowConfidenceNext";

export type ShortcutBinding = {
  key: string;
  /** ⌘/Ctrl */
  mod?: boolean;
  /** Option / Alt */
  alt?: boolean;
  shift?: boolean;
  /** 覆盖 definition 级 allowInTextarea（如 Space 仅全局、⇧⌘Space 含正文） */
  allowInTextarea?: boolean;
  /** 仅语段正文 textarea 内生效（如 Tab 定稿跳下一段） */
  textareaOnly?: boolean;
};

export type EditorShortcutDefinition = {
  id: EditorShortcutId;
  bindings: ShortcutBinding[];
  keysLabel: string;
  footerAction?: string;
  panelAction: string;
  allowInTextarea?: boolean;
  /** 默认 global；waveform 仅波形 shell 有焦点时生效 */
  scope?: EditorShortcutScope;
  /** 默认 true；false 时无打开文件也可触发（如打开设置） */
  requiresOpenFile?: boolean;
};

export type EditorShortcutPanelSection = {
  id: string;
  title: string;
  rows: Array<{ id: string; keys: string; action: string }>;
};
