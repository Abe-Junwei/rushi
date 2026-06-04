import { useAsrBridgeController, type AsrHealthState } from "./useAsrBridgeController";
import { funasrManualSetupCommands, parseAsrHealthJson } from "../services/asr/asrHealthParse";
import { useAsrSetupController } from "./useAsrSetupController";
import { useProjectLifecycleController, type BusyReason } from "./useProjectLifecycleController";
import { useCallback, useRef } from "react";
import { refreshLocalAsrDiagnostics } from "./refreshLocalAsrDiagnostics";

export type { AsrHealthState, BusyReason };
export type BusyPack = { busy: boolean; reason: BusyReason | null };
export type ProjectControllerApi = ReturnType<typeof useProjectController>;

export { parseAsrHealthJson, funasrManualSetupCommands };

export function useProjectController() {
  const refreshSetupDiagnoseRef = useRef<
    ((options?: { resetSteps?: boolean; touchUi?: boolean }) => Promise<unknown>) | null
  >(null);

  const asr = useAsrBridgeController({
    refreshEnvironmentDiagnostics: async () => {
      const refreshSetup = refreshSetupDiagnoseRef.current;
      if (!refreshSetup) return;
      await refreshSetup({ resetSteps: false, touchUi: false });
    },
  });
  const { refreshAsrHealth, refreshAsrModelCacheInfo } = asr;
  const refreshAsrRuntimeInfo = useCallback(async () => {
    await refreshLocalAsrDiagnostics({
      refreshAsrHealth,
      refreshAsrModelCacheInfo,
      refreshSetupDiagnose: refreshSetupDiagnoseRef.current ?? undefined,
    });
  }, [refreshAsrHealth, refreshAsrModelCacheInfo]);
  const asrSetup = useAsrSetupController({
    refreshAsrHealth: asr.refreshAsrHealth,
    refreshAsrRuntimeInfo,
    prepareDefaultFunasrModel: asr.prepareDefaultFunasrModel,
    getSetupSelection: () => ({
      selectedHubModelId: asr.localAsrModelCatalog.selectedHubModelId,
      catalogStatus: asr.localAsrModelCatalog.catalogStatus,
    }),
  });
  refreshSetupDiagnoseRef.current = asrSetup.refreshSetupDiagnose;

  const localTranscribePreflight = useCallback(
    () => asr.asrPresentation.blockReason,
    [asr.asrPresentation],
  );

  const lifecycle = useProjectLifecycleController(
    localTranscribePreflight,
    asr.sttOnlineRuntimeEpoch,
  );

  return {
    // Lifecycle
    projects: lifecycle.projects,
    current: lifecycle.current,
    currentFileId: lifecycle.currentFileId,
    segments: lifecycle.segments,
    selectedIdx: lifecycle.selectedIdx,
    setSelectedIdx: lifecycle.setSelectedIdx,
    audioSrc: lifecycle.audioSrc,
    error: lifecycle.error,
    setError: lifecycle.setError,
    busy: lifecycle.busy,
    busyReason: lifecycle.busyReason,
    newName: lifecycle.newName,
    setNewName: lifecycle.setNewName,
    pickedPath: lifecycle.pickedPath,
    transcribeHints: lifecycle.transcribeHints,
    transcribeProgress: lifecycle.transcribeProgress,
    transcribeCancelling: lifecycle.transcribeCancelling,
    transcribePreviewActive: lifecycle.transcribePreviewActive,
    transcribeOverwriteDialogOpen: lifecycle.transcribeOverwriteDialogOpen,
    transcribeOverwriteSegmentCount: lifecycle.transcribeOverwriteSegmentCount,
    transcribeVocabularyPreflightLines: lifecycle.transcribeVocabularyPreflightLines,
    refreshProjects: lifecycle.refreshProjects,
    pickAudio: lifecycle.pickAudio,
    clearPickedAudio: lifecycle.clearPickedAudio,
    createProject: lifecycle.createProject,
    createEmptyProject: lifecycle.createEmptyProject,
    createProjectFromText: lifecycle.createProjectFromText,
    loadProject: lifecycle.loadProject,
    refreshCurrentProject: lifecycle.refreshCurrentProject,
    restoreEditorFromEditLog: lifecycle.restoreEditorFromEditLog,
    openFile: lifecycle.openFile,
    openLastEditorWorkspace: lifecycle.openLastEditorWorkspace,
    closeFile: lifecycle.closeFile,
    closeProject: lifecycle.closeProject,
    runTranscribe: lifecycle.runTranscribe,
    cancelTranscribe: lifecycle.cancelTranscribe,
    confirmTranscribeOverwrite: lifecycle.confirmTranscribeOverwrite,
    cancelTranscribeOverwrite: lifecycle.cancelTranscribeOverwrite,
    saveSegments: lifecycle.saveSegments,
    confirmSegmentEditAndAdvance: lifecycle.confirmSegmentEditAndAdvance,
    canConfirmSegmentEdit: lifecycle.canConfirmSegmentEdit,
    getSavedSnapshot: lifecycle.getSavedSnapshot,
    editorSpansForText: lifecycle.editorSpansForText,
    editorCorrectPopover: lifecycle.editorCorrectPopover,
    editorCorrectPopoverSuggestions: lifecycle.editorCorrectPopoverSuggestions,
    openEditorCorrectPopover: lifecycle.openEditorCorrectPopover,
    closeEditorCorrectPopover: lifecycle.closeEditorCorrectPopover,
    applyEditorInlineCorrection: lifecycle.applyEditorInlineCorrection,
    autoSaveFooterStatus: lifecycle.autoSaveFooterStatus,
    deleteProject: lifecycle.deleteProject,
    exportTxt: lifecycle.exportTxt,
    exportSrt: lifecycle.exportSrt,
    exportDocx: lifecycle.exportDocx,
    exportDeliveryDocx: lifecycle.exportDeliveryDocx,
    exportDiagnosticBundle: lifecycle.exportDiagnosticBundle,
    exportProjectBundle: lifecycle.exportProjectBundle,
    importProjectBundle: lifecycle.importProjectBundle,
    openAppDataFolder: lifecycle.openAppDataFolder,
    applyDetail: lifecycle.applyDetail,

    // Segment mutations
    undo: lifecycle.undo,
    redo: lifecycle.redo,
    updateSegmentText: lifecycle.updateSegmentText,
    updateSegmentTime: lifecycle.updateSegmentTime,
    updateSegmentBounds: lifecycle.updateSegmentBounds,
    splitAtSelection: lifecycle.splitAtSelection,
    splitAtPlayhead: lifecycle.splitAtPlayhead,
    mergeWithNext: lifecycle.mergeWithNext,
    mergeWithPrev: lifecycle.mergeWithPrev,
    mergeWithNextAt: lifecycle.mergeWithNextAt,
    mergeWithPrevAt: lifecycle.mergeWithPrevAt,
    deleteSegmentAt: lifecycle.deleteSegmentAt,
    insertSegmentAfter: lifecycle.insertSegmentAfter,
    insertSegmentFromTimeRange: lifecycle.insertSegmentFromTimeRange,
    flushSegmentTextDrafts: lifecycle.flushSegmentTextDrafts,
    canAutoPunctuate: lifecycle.canAutoPunctuate,
    autoPunctuateBlockReason: lifecycle.autoPunctuateBlockReason,
    autoPunctuateDialog: lifecycle.autoPunctuateDialog,
    requestAutoPunctuate: lifecycle.requestAutoPunctuate,
    confirmAutoPunctuateConsent: lifecycle.confirmAutoPunctuateConsent,
    confirmAutoPunctuateWriteback: lifecycle.confirmAutoPunctuateWriteback,
    cancelAutoPunctuate: lifecycle.cancelAutoPunctuate,
    canRefineSegments: lifecycle.canRefineSegments,
    segmentRefineBlockReason: lifecycle.segmentRefineBlockReason,
    segmentRefineDialog: lifecycle.segmentRefineDialog,
    requestSegmentRefine: lifecycle.requestSegmentRefine,
    confirmSegmentRefineConsent: lifecycle.confirmSegmentRefineConsent,
    confirmSegmentRefineWriteback: lifecycle.confirmSegmentRefineWriteback,
    cancelSegmentRefine: lifecycle.cancelSegmentRefine,
    canLexiconProofread: lifecycle.canLexiconProofread,
    lexiconProofreadBlockReason: lifecycle.lexiconProofreadBlockReason,
    lexiconProofreadDialog: lifecycle.lexiconProofreadDialog,
    requestLexiconProofread: lifecycle.requestLexiconProofread,
    confirmLexiconProofreadConsent: lifecycle.confirmLexiconProofreadConsent,
    confirmLexiconProofreadWriteback: lifecycle.confirmLexiconProofreadWriteback,
    setLexiconAcceptRulesOnWriteback: lifecycle.setLexiconAcceptRulesOnWriteback,
    toggleLexiconProofreadOp: lifecycle.toggleLexiconProofreadOp,
    setAllLexiconProofreadOps: lifecycle.setAllLexiconProofreadOps,
    cancelLexiconProofread: lifecycle.cancelLexiconProofread,
    canFindReplace: lifecycle.canFindReplace,
    findReplaceBlockReason: lifecycle.findReplaceBlockReason,
    findReplaceDialog: lifecycle.findReplaceDialog,
    openFindReplace: lifecycle.openFindReplace,
    closeFindReplace: lifecycle.closeFindReplace,
    setFindReplaceFindText: lifecycle.setFindReplaceFindText,
    setFindReplaceReplaceText: lifecycle.setFindReplaceReplaceText,
    findReplaceRunSearch: lifecycle.findReplaceRunSearch,
    findReplaceSelectMatch: lifecycle.findReplaceSelectMatch,
    findReplaceGoNext: lifecycle.findReplaceGoNext,
    findReplaceGoPrev: lifecycle.findReplaceGoPrev,
    findReplaceCurrent: lifecycle.findReplaceCurrent,
    findReplaceRequestReplaceAll: lifecycle.findReplaceRequestReplaceAll,
    findReplaceConfirmReplaceAll: lifecycle.findReplaceConfirmReplaceAll,
    findReplaceCancelReplaceAllPreview: lifecycle.findReplaceCancelReplaceAllPreview,
    findReplaceEditorHighlight: lifecycle.findReplaceEditorHighlight,
    findReplaceReplaceAndNext: lifecycle.findReplaceReplaceAndNext,
    canApplyCorrectionRules: lifecycle.canApplyCorrectionRules,
    correctionRulesBlockReason: lifecycle.correctionRulesBlockReason,
    correctionRulesDialog: lifecycle.correctionRulesDialog,
    requestCorrectionRules: lifecycle.requestCorrectionRules,
    confirmCorrectionRulesWriteback: lifecycle.confirmCorrectionRulesWriteback,
    cancelCorrectionRules: lifecycle.cancelCorrectionRules,
    canCorrectSuggestions: lifecycle.canCorrectSuggestions,
    correctSuggestionsBlockReason: lifecycle.correctSuggestionsBlockReason,
    correctSuggestionsDialog: lifecycle.correctSuggestionsDialog,
    requestCorrectSuggestions: lifecycle.requestCorrectSuggestions,
    applyCorrectSuggestion: lifecycle.applyCorrectSuggestion,
    cancelCorrectSuggestions: lifecycle.cancelCorrectSuggestions,
    openFindReplaceForCorrectSelection: lifecycle.openFindReplaceForCorrectSelection,
    glossaryLearnDialog: lifecycle.glossaryLearnDialog,
    dismissGlossaryLearnPrompt: lifecycle.dismissGlossaryLearnPrompt,
    confirmAddToGlossary: lifecycle.confirmAddToGlossary,
    closeGlossaryLearnPrompt: lifecycle.closeGlossaryLearnPrompt,
    manualCorrectionMemoryDialog: lifecycle.manualCorrectionMemoryDialog,
    openManualCorrectionMemoryDialog: lifecycle.openManualCorrectionMemoryDialog,
    closeManualCorrectionMemoryDialog: lifecycle.closeManualCorrectionMemoryDialog,
    setManualCorrectionRight: lifecycle.setManualCorrectionRight,
    setManualCorrectionAlsoGlossary: lifecycle.setManualCorrectionAlsoGlossary,
    confirmManualCorrectionMemory: lifecycle.confirmManualCorrectionMemory,
    bumpLlmRuntimeChanged: lifecycle.bumpLlmRuntimeChanged,
    closeGateOpen: lifecycle.closeGateOpen,
    closeGateIntent: lifecycle.closeGateIntent,
    stayAfterCloseAttempt: lifecycle.stayAfterCloseAttempt,
    discardUnsavedAndClose: lifecycle.discardUnsavedAndClose,
    saveAndClose: lifecycle.saveAndClose,

    // ASR bridge
    asrHealth: asr.asrHealth,
    asrHealthDetail: asr.asrHealthDetail,
    asrPresentation: asr.asrPresentation,
    bundledAsrDiag: asr.bundledAsrDiag,
    asrCaps: asr.asrCaps,
    asrModelCacheInfo: asr.asrModelCacheInfo,
    waveformPeaksCacheInfo: asr.waveformPeaksCacheInfo,
    asrModelCacheBusy: asr.asrModelCacheBusy,
    asrCacheMessage: asr.asrCacheMessage,
    sttOnlineBridgeReady: asr.sttOnlineBridgeReady,
    funasrInstallMessage: asr.funasrInstallMessage,
    prepareModelBusy: asr.prepareModelBusy,
    prepareModelProgress: asr.prepareModelProgress,
    prepareModelFailure: asr.prepareModelFailure,
    prepareDefaultFunasrModel: asr.prepareDefaultFunasrModel,
    cancelPrepareModel: asr.cancelPrepareModel,
    localAsrModelCatalog: asr.localAsrModelCatalog,
    refreshAsrModelCacheInfo: asr.refreshAsrModelCacheInfo,
    clearAsrModelCache: asr.clearAsrModelCache,
    clearOrphanWaveformPeaksCache: asr.clearOrphanWaveformPeaksCache,
    retryBundledAsrSidecar: asr.retryBundledAsrSidecar,
    refreshAsrHealth: asr.refreshAsrHealth,
    installFunasrDepsInteractive: asr.installFunasrDepsInteractive,
    copyFunasrManualCommands: asr.copyFunasrManualCommands,
    bumpSttOnlineRuntimeChanged: asr.bumpSttOnlineRuntimeChanged,
    asrSetup,
  };
}
