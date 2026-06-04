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
    requestCorrectionRules: () => {
      void correctionRules.requestCorrectionRules();
    },
    confirmCorrectionRulesWriteback: () => {
      void correctionRules.confirmCorrectionRulesWriteback();
    },
    cancelCorrectionRules: correctionRules.cancelCorrectionRules,
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
