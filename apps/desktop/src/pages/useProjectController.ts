import {
  useAsrBridgeController,
  type AsrHealthState,
  parseAsrHealthJson,
  funasrManualSetupCommands,
} from "./useAsrBridgeController";
import { useProjectLifecycleController, type BusyReason } from "./useProjectLifecycleController";

export type { AsrHealthState, BusyReason };
export type BusyPack = { busy: boolean; reason: BusyReason | null };
export type ProjectControllerApi = ReturnType<typeof useProjectController>;

export { parseAsrHealthJson, funasrManualSetupCommands };

export function useProjectController() {
  const lifecycle = useProjectLifecycleController();
  const asr = useAsrBridgeController();

  return {
    // Lifecycle
    projects: lifecycle.projects,
    current: lifecycle.current,
    segments: lifecycle.segments,
    selectedIdx: lifecycle.selectedIdx,
    setSelectedIdx: lifecycle.setSelectedIdx,
    audioSrc: lifecycle.audioSrc,
    error: lifecycle.error,
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
    loadProject: lifecycle.loadProject,
    runTranscribe: lifecycle.runTranscribe,
    saveSegments: lifecycle.saveSegments,
    deleteProject: lifecycle.deleteProject,
    exportTxt: lifecycle.exportTxt,
    exportSrt: lifecycle.exportSrt,
    exportDocx: lifecycle.exportDocx,
    exportDiagnosticBundle: lifecycle.exportDiagnosticBundle,
    openAppDataFolder: lifecycle.openAppDataFolder,

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
    flushSegmentTextDraftsFromDom: lifecycle.flushSegmentTextDraftsFromDom,
    attachSegmentListDomRoot: lifecycle.attachSegmentListDomRoot,

    // ASR bridge
    asrHealth: asr.asrHealth,
    asrHealthDetail: asr.asrHealthDetail,
    bundledAsrDiag: asr.bundledAsrDiag,
    asrCaps: asr.asrCaps,
    sttOnlineBridgeReady: asr.sttOnlineBridgeReady,
    funasrInstallMessage: asr.funasrInstallMessage,
    prepareModelBusy: asr.prepareModelBusy,
    prepareModelProgress: asr.prepareModelProgress,
    prepareModelFailure: asr.prepareModelFailure,
    prepareDefaultFunasrModel: asr.prepareDefaultFunasrModel,
    retryBundledAsrSidecar: asr.retryBundledAsrSidecar,
    refreshAsrHealth: asr.refreshAsrHealth,
    installFunasrDepsInteractive: asr.installFunasrDepsInteractive,
    copyFunasrManualCommands: asr.copyFunasrManualCommands,
    bumpSttOnlineRuntimeChanged: asr.bumpSttOnlineRuntimeChanged,
  };
}
