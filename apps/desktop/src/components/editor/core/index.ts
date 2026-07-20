export {
  buildTranscriptEditorState,
  type BuildTranscriptEditorStateOptions,
} from "./buildTranscriptEditorState";
export { serializeTranscriptEditorState } from "./serializeTranscriptEditorState";
export {
  segmentMetaField,
  setSegmentMetaEffect,
  type SegmentMeta,
} from "./segmentMetaField";
export {
  createTransactionPersistenceBridge,
  type TransactionPersistenceBridgeHandlers,
} from "./transactionPersistenceBridge";
export {
  TRANSCRIPT_NEWLINE_ESCAPE,
  encodeSegmentTextForDocLine,
  decodeDocLineToSegmentText,
  auditSegmentNewlines,
} from "./segmentNewlineCodec";
export {
  TRANSCRIPT_EDITOR_CORE_FLAG_KEY,
  readTranscriptEditorCoreEnabled,
  writeTranscriptEditorCoreEnabled,
  setTranscriptEditorCoreEnabledForTests,
} from "./transcriptEditorCoreFlag";
export {
  transcriptMultiSelectionField,
  setTranscriptMultiSelectionEffect,
  primarySegmentIdx,
  getTranscriptMultiSelection,
  transcriptMultiSelectionEqual,
  type TranscriptMultiSelection,
} from "./selectionField";
export {
  selectSegmentTransaction,
  movePrimarySegmentTransaction,
  selectSegmentCommand,
  movePrimarySegmentCommand,
  shouldConsumeTranscriptContentMousedown,
  type SelectSegmentOptions,
} from "./selectionCommands";
export { transcriptSelectionDecorations } from "./selectionDecorations";
export {
  createTranscriptProjectionPublisher,
  syncTranscriptProjectionFromView,
  getTranscriptProjectionSnapshot,
  subscribeTranscriptProjection,
  subscribeTranscriptSelectionProjection,
  resetTranscriptProjectionForTests,
  seedTranscriptProjectionForTests,
  type TranscriptProjectionSnapshot,
} from "./transcriptProjection";
export {
  transcriptEditorCoreExtensions,
  type TranscriptEditorCoreExtensionsOptions,
} from "./transcriptEditorCoreExtensions";
export {
  CM_SEGMENT_IDX_ATTR,
  resolveTranscriptGutterSegmentIdx,
} from "./transcriptGutterSegmentIdx";
export {
  createTranscriptMetaGutter,
  buildTranscriptMetaMarker,
  handleTranscriptMetaGutterMousedown,
  computeTranscriptMetaGutterWidthPx,
  transcriptMetaGutterTheme,
  transcriptMetaGutterExtensions,
  type TranscriptMetaGutterOptions,
} from "./metaGutter";
export {
  createTranscriptStageGutter,
  buildTranscriptStageMarker,
  resolveTranscriptStageGutterSegmentIdx,
  handleTranscriptStageGutterMousedown,
  CM_SEGMENT_ANNOTATION_ATTR,
  transcriptStageGutterTheme,
  transcriptStageGutterExtensions,
  type TranscriptStageGutterOptions,
} from "./stageGutter";
export {
  revealSegmentTransaction,
  revealSegmentInView,
} from "./revealSegment";
export {
  registerTranscriptEditorView,
  getTranscriptEditorView,
  dispatchTranscriptEditorSelection,
  dispatchTranscriptEditorSelectionIndices,
  dispatchTranscriptEditorSelectionRange,
  dispatchTranscriptSplitAtMidpoint,
  dispatchTranscriptSplitAtTime,
  dispatchTranscriptMergeWithNext,
  dispatchTranscriptMergeWithPrev,
  dispatchTranscriptMergeRange,
  dispatchTranscriptDeleteAt,
  dispatchTranscriptDeleteRange,
  dispatchTranscriptDeleteIndices,
  dispatchTranscriptInsertAt,
  dispatchTranscriptReplaceCharRange,
  dispatchTranscriptReplaceLineText,
  dispatchTranscriptApplyTextsBulk,
  dispatchTranscriptApplySegments,
  dispatchTranscriptSyncMetaFromSegments,
  dispatchTranscriptFocusFindMatch,
  dispatchTranscriptPanelHighlight,
} from "./transcriptEditorViewHandle";
export {
  setTranscriptPanelHighlightEffect,
  transcriptPanelHighlightField,
  type TranscriptPanelHighlight,
} from "./panelHighlightField";
export {
  replaceSegmentLineTextCommand,
  replaceSegmentCharRangeCommand,
  applySegmentTextsBulkCommand,
  focusFindMatchCommand,
  readTranscriptEditorSelectionText,
} from "./textEditCommands";
export {
  transcriptClipboardFilters,
  copyTranscriptSelection,
  cutTranscriptSelection,
  pasteTranscriptClipboard,
  readTranscriptClipboardSelectionText,
} from "./transcriptClipboard";
export { segmentCharRangeToDocRange } from "./segmentCharRangeToDoc";
export {
  waveformSelectionViewFromProjection,
  effectiveTranscriptPrimaryIdx,
} from "./projectionWaveformBridge";
export {
  mergeProjectedStructureWithBaseline,
  applyProjectedStructureMutation,
} from "./applyProjectedStructureMutation";
export { persistTranscriptStructureFromView } from "./persistTranscriptStructureFromView";
export {
  splitSegmentAtMidpointCommand,
  splitSegmentAtTimeCommand,
  mergeWithNextCommand,
  mergeWithPrevCommand,
  mergeSegmentRangeCommand,
  deleteSegmentAtCommand,
  deleteSegmentRangeCommand,
  deleteSegmentIndicesCommand,
  insertSegmentAtCommand,
  applyTranscriptSegmentsStructure,
  replaceTranscriptSegmentsTransaction,
  withLiveTextsFromState,
} from "./structureCommands";
export {
  createOnDocChangedBridge,
  applyProjectedTextDiff,
  flushCm6TextProjection,
  cancelPendingOnDocChangedFlush,
  flushPendingOnDocChangedProjection,
  isTranscriptEditorComposing,
} from "./onDocChanged";
export {
  transcriptEditorKeymap,
  createTranscriptEditorKeymap,
  runTranscriptArrowMove,
  transcriptLineCountGuard,
  transcriptStructureEditAnnotation,
  type TranscriptEditorKeymapOptions,
  type TranscriptPrimaryMovedHandler,
} from "./transcriptEditorKeymap";
export {
  TRANSCRIPT_EDITOR_CORE_ATTR,
  TRANSCRIPT_EDITOR_CORE_SELECTOR,
  isTranscriptEditorCoreTarget,
  isTranscriptEditorCoreFocused,
} from "./transcriptEditorDom";
export {
  clampEditorSelectionToDocLine,
  selectionCrossesDocLine,
  createTranscriptTextDragClamp,
  setTranscriptTextDragLineEffect,
  transcriptTextDragLineField,
  filterTransactionForTextDragClamp,
} from "./transcriptTextDragClamp";
export { TranscriptEditorCore } from "./TranscriptEditorCore";
export type { TranscriptEditorCoreProps } from "./TranscriptEditorCore";
