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
  type TranscriptMultiSelection,
} from "./selectionField";
export {
  selectSegmentTransaction,
  movePrimarySegmentTransaction,
  selectSegmentCommand,
  movePrimarySegmentCommand,
  type SelectSegmentOptions,
} from "./selectionCommands";
export { transcriptSelectionDecorations } from "./selectionDecorations";
export {
  createTranscriptProjectionPublisher,
  syncTranscriptProjectionFromView,
  getTranscriptProjectionSnapshot,
  subscribeTranscriptProjection,
  resetTranscriptProjectionForTests,
  seedTranscriptProjectionForTests,
  useTranscriptProjection,
  useTranscriptProjectionPrimaryIdx,
  type TranscriptProjectionSnapshot,
} from "./transcriptProjection";
export {
  transcriptEditorCoreExtensions,
  type TranscriptEditorCoreExtensionsOptions,
} from "./transcriptEditorCoreExtensions";
export {
  createTranscriptMetaGutter,
  buildTranscriptMetaMarker,
  computeTranscriptMetaGutterWidthPx,
  transcriptMetaGutterTheme,
  transcriptMetaGutterExtensions,
  type TranscriptMetaGutterOptions,
} from "./metaGutter";
export {
  createTranscriptStageGutter,
  buildTranscriptStageMarker,
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
export { TranscriptEditorCore } from "./TranscriptEditorCore";
export type { TranscriptEditorCoreProps } from "./TranscriptEditorCore";
