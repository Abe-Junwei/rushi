import {
  useAsrBridgeController,
  type AsrHealthState,
  parseAsrHealthJson,
  funasrManualSetupCommands,
} from "./useAsrBridgeController";
import { useAsrSetupController } from "./useAsrSetupController";
import { useProjectLifecycleController, type BusyReason } from "./useProjectLifecycleController";
import { useCallback } from "react";

export type { AsrHealthState, BusyReason };
export type BusyPack = { busy: boolean; reason: BusyReason | null };
export type ProjectControllerApi = ReturnType<typeof useProjectController>;

export { parseAsrHealthJson, funasrManualSetupCommands };

export function useProjectController() {
  const lifecycle = useProjectLifecycleController();
  const asr = useAsrBridgeController();
  const { refreshAsrHealth, refreshAsrModelCacheInfo } = asr;
  const refreshAsrRuntimeInfo = useCallback(async () => {
    await refreshAsrHealth();
    await refreshAsrModelCacheInfo();
  }, [refreshAsrHealth, refreshAsrModelCacheInfo]);
  const asrSetup = useAsrSetupController({
    refreshAsrHealth: asr.refreshAsrHealth,
    refreshAsrRuntimeInfo,
    prepareDefaultFunasrModel: asr.prepareDefaultFunasrModel,
  });

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
    refreshProjects: lifecycle.refreshProjects,
    pickAudio: lifecycle.pickAudio,
    clearPickedAudio: lifecycle.clearPickedAudio,
    createProject: lifecycle.createProject,
    createEmptyProject: lifecycle.createEmptyProject,
    createProjectFromText: lifecycle.createProjectFromText,
    loadProject: lifecycle.loadProject,
    refreshCurrentProject: lifecycle.refreshCurrentProject,
    openFile: lifecycle.openFile,
    closeFile: lifecycle.closeFile,
    closeProject: lifecycle.closeProject,
    runTranscribe: lifecycle.runTranscribe,
    saveSegments: lifecycle.saveSegments,
    deleteProject: lifecycle.deleteProject,
    exportTxt: lifecycle.exportTxt,
    exportSrt: lifecycle.exportSrt,
    exportDocx: lifecycle.exportDocx,
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
    autoPunctuateDialog: lifecycle.autoPunctuateDialog,
    requestAutoPunctuate: lifecycle.requestAutoPunctuate,
    confirmAutoPunctuateConsent: lifecycle.confirmAutoPunctuateConsent,
    confirmAutoPunctuateWriteback: lifecycle.confirmAutoPunctuateWriteback,
    cancelAutoPunctuate: lifecycle.cancelAutoPunctuate,
    closeGateOpen: lifecycle.closeGateOpen,
    closeGateIntent: lifecycle.closeGateIntent,
    stayAfterCloseAttempt: lifecycle.stayAfterCloseAttempt,
    discardUnsavedAndClose: lifecycle.discardUnsavedAndClose,
    saveAndClose: lifecycle.saveAndClose,

    // ASR bridge
    asrHealth: asr.asrHealth,
    asrHealthDetail: asr.asrHealthDetail,
    bundledAsrDiag: asr.bundledAsrDiag,
    asrCaps: asr.asrCaps,
    asrModelCacheInfo: asr.asrModelCacheInfo,
    asrModelCacheBusy: asr.asrModelCacheBusy,
    asrCacheMessage: asr.asrCacheMessage,
    sttOnlineBridgeReady: asr.sttOnlineBridgeReady,
    funasrInstallMessage: asr.funasrInstallMessage,
    prepareModelBusy: asr.prepareModelBusy,
    prepareModelProgress: asr.prepareModelProgress,
    prepareModelFailure: asr.prepareModelFailure,
    prepareDefaultFunasrModel: asr.prepareDefaultFunasrModel,
    cancelPrepareModel: asr.cancelPrepareModel,
    refreshAsrModelCacheInfo: asr.refreshAsrModelCacheInfo,
    clearAsrModelCache: asr.clearAsrModelCache,
    retryBundledAsrSidecar: asr.retryBundledAsrSidecar,
    refreshAsrHealth: asr.refreshAsrHealth,
    installFunasrDepsInteractive: asr.installFunasrDepsInteractive,
    copyFunasrManualCommands: asr.copyFunasrManualCommands,
    bumpSttOnlineRuntimeChanged: asr.bumpSttOnlineRuntimeChanged,
    asrSetup,
  };
}
