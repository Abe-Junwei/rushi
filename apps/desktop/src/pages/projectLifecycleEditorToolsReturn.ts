import type { useProjectEditorToolsController } from "./useProjectEditorToolsController";

type EditorTools = ReturnType<typeof useProjectEditorToolsController>;

/** 将编辑器 LLM / 查找替换 / 纠错工具映射为 ProjectLifecycleApi 字段。 */
export function mapEditorToolsLifecycleFields(tools: EditorTools) {
  const {
    findReplace,
    editorCorrectionCatalog,
    editorSegmentCorrect,
    correctSuggestions,
    correctionRules,
    postTranscribeOrchestration,
    bumpLlmRuntimeChanged,
    canConfirmSegmentEdit,
  } = tools;

  return {
    canConfirmSegmentEdit,
    editorSpansForText: editorCorrectionCatalog.spansForText,
    editorCorrectPopover: editorSegmentCorrect.popover,
    editorCorrectPopoverSuggestions: editorSegmentCorrect.popoverSuggestions,
    openEditorCorrectPopover: editorSegmentCorrect.openPopover,
    closeEditorCorrectPopover: editorSegmentCorrect.closePopover,
    applyEditorInlineCorrection: editorSegmentCorrect.applyInlineCorrection,
    canFindReplace: findReplace.canFindReplace,
    findReplaceBlockReason: findReplace.findReplaceBlockReason,
    findReplaceDialog: findReplace.findReplaceDialog,
    openFindReplace: findReplace.openFindReplace,
    closeFindReplace: findReplace.closeFindReplace,
    setFindReplaceFindText: findReplace.setFindReplaceFindText,
    setFindReplaceReplaceText: findReplace.setFindReplaceReplaceText,
    findReplaceRunSearch: findReplace.findReplaceRunSearch,
    findReplaceSelectMatch: findReplace.findReplaceSelectMatch,
    findReplaceGoNext: findReplace.findReplaceGoNext,
    findReplaceGoPrev: findReplace.findReplaceGoPrev,
    findReplaceCurrent: findReplace.findReplaceCurrent,
    findReplaceRequestReplaceAll: findReplace.findReplaceRequestReplaceAll,
    findReplaceConfirmReplaceAll: findReplace.findReplaceConfirmReplaceAll,
    findReplaceCancelReplaceAllPreview: findReplace.findReplaceCancelReplaceAllPreview,
    findReplaceEditorHighlight: findReplace.findReplaceEditorHighlight,
    findReplaceReplaceAndNext: findReplace.findReplaceReplaceAndNext,
    canApplyCorrectionRules: correctionRules.canApplyCorrectionRules,
    correctionRulesBlockReason: correctionRules.correctionRulesBlockReason,
    correctionRulesDialog: correctionRules.correctionRulesDialog,
    correctionRulesStableConflictMessage: correctionRules.correctionRulesStableConflictMessage,
    requestCorrectionRules: () => {
      void correctionRules.openCorrectionRulesManual();
    },
    requestPostTranscribeProcessing: () => {
      void correctionRules.requestPostTranscribeProcessing();
    },
    openCorrectionRulesManual: () => {
      void correctionRules.openCorrectionRulesManual();
    },
    confirmCorrectionRulesWriteback: () => {
      void correctionRules.confirmCorrectionRulesWriteback();
    },
    toggleCorrectionRulesSegment: correctionRules.toggleCorrectionRulesSegment,
    focusCorrectionRulesPreviewSegment: correctionRules.focusCorrectionRulesPreviewSegment,
    correctionRulesEditorHighlight: correctionRules.correctionRulesEditorHighlight,
    cancelCorrectionRules: correctionRules.cancelCorrectionRules,
    closeCorrectionRulesEmpty: correctionRules.closeCorrectionRulesEmpty,
    canOfferPostTranscribeStageB: postTranscribeOrchestration.canOfferPostTranscribeStageB,
    postTranscribeStageBBlockReason: postTranscribeOrchestration.postTranscribeStageBBlockReason,
    postTranscribeStageBDialog: postTranscribeOrchestration.postTranscribeStageBDialog,
    openPostTranscribeStageB: postTranscribeOrchestration.offerPostTranscribeStageB,
    confirmPostTranscribeStageBConsent: postTranscribeOrchestration.confirmPostTranscribeStageBConsent,
    confirmPostTranscribeStageBWriteback: () => {
      void postTranscribeOrchestration.confirmPostTranscribeStageBWriteback();
    },
    togglePostTranscribeStageBSegment: postTranscribeOrchestration.togglePostTranscribeStageBSegment,
    focusPostTranscribeStageBSegment: postTranscribeOrchestration.focusPostTranscribeStageBSegment,
    postTranscribeStageBPreviewFocusSegmentIdx:
      postTranscribeOrchestration.postTranscribeStageBPreviewFocusSegmentIdx,
    cancelPostTranscribeStageB: postTranscribeOrchestration.cancelPostTranscribeStageB,
    canCorrectSuggestions: correctSuggestions.canCorrectSuggestions,
    correctSuggestionsBlockReason: correctSuggestions.correctSuggestionsBlockReason,
    correctSuggestionsDialog: correctSuggestions.correctSuggestionsDialog,
    requestCorrectSuggestions: (selectionOverride?: string) => {
      void correctSuggestions.requestCorrectSuggestions(selectionOverride);
    },
    applyCorrectSuggestion: correctSuggestions.applyCorrectSuggestion,
    cancelCorrectSuggestions: correctSuggestions.cancelCorrectSuggestions,
    openFindReplaceForCorrectSelection: correctSuggestions.openFindReplaceForCorrectSelection,
    bumpLlmRuntimeChanged,
  };
}
