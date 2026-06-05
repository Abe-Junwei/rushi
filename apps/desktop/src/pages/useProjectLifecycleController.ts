import { useCallback, useRef, useState } from "react";
import type { ProjectDetail } from "../tauri/projectApi";
import * as p1 from "../tauri/projectApi";
import { useExportController } from "./useExportController";
import { useProjectCrudController } from "./useProjectCrudController";
import { useSegmentMutationController } from "./useSegmentMutationController";
import { useProjectBusyState } from "./useProjectBusyState";
import { useProjectListState } from "./useProjectListState";
import { useProjectEditorState } from "./useProjectEditorState";
import { useGlossaryLearnPromptController } from "./useGlossaryLearnPromptController";
import { useManualCorrectionMemoryDialog } from "./useManualCorrectionMemoryDialog";
import {
  useProjectCloseGateController,
  type ProjectCloseGateControllerApi,
} from "./useProjectCloseGateController";
import { useSegmentDirtyState } from "./useSegmentDirtyState";
import { useAutoSaveSegments } from "./useAutoSaveSegments";
import {
  useTranscribeJobController,
  type LocalTranscribePreflight,
} from "./useTranscribeJobController";
import { useProjectSaveController } from "./useProjectSaveController";
import { useProjectEditorToolsController } from "./useProjectEditorToolsController";
import { mapEditorToolsLifecycleFields } from "./projectLifecycleEditorToolsReturn";
import type { ProjectLifecycleApi } from "./ProjectLifecycleApi";

export type { ProjectLifecycleApi } from "./ProjectLifecycleApi";
export type { BusyReason } from "./useProjectCrudController";
export type { LocalTranscribePreflight };

export function useProjectLifecycleController(
  localTranscribePreflight: LocalTranscribePreflight = () => null,
  sttOnlineRuntimeEpoch = 0,
): ProjectLifecycleApi {
  const { busy, busyReason, beginBusy, endBusy } = useProjectBusyState();
  const [error, setError] = useState<string>("");
  const { projects, refreshProjects } = useProjectListState(setError);

  const {
    current,
    setCurrent,
    currentFileId,
    segments,
    setSegments,
    selectedIdx,
    setSelectedIdx,
    audioSrc,
    setAudioSrc,
    segmentsRef,
    selectedIdxRef,
    openFile,
    closeFile,
    refreshCurrentProject: refreshCurrentProjectBase,
    applyDetailBase,
  } = useProjectEditorState(setError);

  const [newName, setNewName] = useState("未命名项目");
  const [pickedPath, setPickedPath] = useState<string | null>(null);
  const closeGateRef = useRef<ProjectCloseGateControllerApi | null>(null);
  const mutations = useSegmentMutationController({
    segmentsRef,
    setSegments,
    selectedIdxRef,
    setSelectedIdx,
    setError,
    busy,
  });

  const dirty = useSegmentDirtyState({
    currentFileId,
    segmentsRef,
    flushSegmentTextDrafts: mutations.flushSegmentTextDrafts,
  });

  const glossaryLearn = useGlossaryLearnPromptController({ setError });
  const manualCorrectionMemory = useManualCorrectionMemoryDialog({
    busy,
    setError,
    checkGlossaryLearnAfterSave: glossaryLearn.checkGlossaryLearnAfterSave,
  });

  const saveController = useProjectSaveController({
    busy,
    current,
    currentFileId,
    segmentsRef,
    selectedIdxRef,
    setCurrent,
    setSegments,
    setSelectedIdx,
    setError,
    beginBusy,
    endBusy,
    mutations,
    dirty,
    checkGlossaryLearnAfterSave: () => {
      void glossaryLearn.checkGlossaryLearnAfterSave();
    },
  });

  const {
    saveInFlightRef,
    clearAutoSaveRef,
    notifySegmentsPersistedRef,
    saveSegments,
    confirmSegmentEditAndAdvance,
    restoreEditorFromEditLog,
  } = saveController;

  const autoSave = useAutoSaveSegments({
    enabled: Boolean(currentFileId),
    currentFileId,
    segments,
    busy,
    saveInFlightRef,
    hasUnsavedSegmentChanges: dirty.hasUnsavedSegmentChanges,
    saveSegments,
    registerClearScheduled: (fn) => {
      clearAutoSaveRef.current = fn;
    },
    registerOnPersisted: (fn) => {
      notifySegmentsPersistedRef.current = fn;
    },
  });

  const applyDetailBaseOnly = useCallback(
    (d: ProjectDetail) => {
      mutations.resetMutationHistory();
      applyDetailBase(d);
      setPickedPath(null);
    },
    [mutations, applyDetailBase],
  );

  const transcribeJob = useTranscribeJobController({
    busy,
    beginBusy,
    endBusy,
    current,
    currentFileId,
    segments,
    segmentsRef,
    setCurrent,
    setSegments,
    setError,
    closeGate: {
      openFileWrapped: async (fileId: string) => {
        const gate = closeGateRef.current;
        if (!gate) throw new Error("closeGate not ready");
        await gate.openFileWrapped(fileId);
      },
    },
    mutations,
    localTranscribePreflight,
    sttOnlineRuntimeEpoch,
    clearScheduledAutoSave: () => clearAutoSaveRef.current(),
  });

  const applyDetail = useCallback(
    (d: ProjectDetail) => {
      applyDetailBaseOnly(d);
      transcribeJob.applyDetailClearTranscribe(d);
    },
    [applyDetailBaseOnly, transcribeJob],
  );

  const closeGate = useProjectCloseGateController({
    applyDetail,
    beginBusy,
    busy,
    closeFile,
    current,
    currentFileId,
    dirty,
    endBusy,
    openFile,
    saveSegments,
    setCurrent,
    setError,
    setTranscribeHints: transcribeJob.setTranscribeHints,
    onClearTranscribeSession: () => {
      transcribeJob.setTranscribeWarnings([]);
    },
    resetMutationHistory: mutations.resetMutationHistory,
    projects,
  });
  closeGateRef.current = closeGate;

  const refreshCurrentProject = useCallback(async () => {
    if (busy || !current) return;
    await refreshCurrentProjectBase();
  }, [busy, current, refreshCurrentProjectBase]);

  const pickAudio = useCallback(async () => {
    if (busy) return;
    setError("");
    try {
      const p = await p1.pickAudioPath();
      setPickedPath(p ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [busy]);

  const clearPickedAudio = useCallback(() => {
    setPickedPath(null);
  }, []);

  const crud = useProjectCrudController({
    pickedPath,
    newName,
    current,
    setError,
    beginBusy,
    endBusy,
    applyDetail,
    refreshProjects,
    mutations,
    setCurrent,
    setSegments,
    setAudioSrc,
    setTranscribeHints: transcribeJob.setTranscribeHints,
  });

  const editorTools = useProjectEditorToolsController({
    busy,
    busyReason,
    currentFileId,
    selectedIdx,
    segments,
    segmentsRef,
    setSegments,
    setSelectedIdx,
    flushSegmentTextDrafts: mutations.flushSegmentTextDrafts,
    updateSegmentText: mutations.updateSegmentText,
    pushUndo: mutations.pushUndo,
    dirty,
    setError,
    saveSegments,
    transcribeWarnings: transcribeJob.transcribeWarnings,
  });

  const openAppDataFolder = useCallback(async () => {
    if (busy) return;
    setError("");
    try {
      await p1.openAppDataFolder();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [busy]);

  const exports = useExportController({
    current,
    currentFileId,
    segmentsRef,
    setError,
    flushSegmentTextDrafts: mutations.flushSegmentTextDrafts,
    beginBusy,
    endBusy,
    refreshProjects,
    applyDetail,
  });

  return {
    projects, current, currentFileId, segments, selectedIdx, setSelectedIdx,
    audioSrc, error, busy, busyReason, newName, setNewName, pickedPath,
    transcribeHints: transcribeJob.transcribeHints,
    transcribeProgress: transcribeJob.transcribeProgress,
    transcribeCancelling: transcribeJob.transcribeCancelling,
    transcribePreviewActive: busy && busyReason === "transcribe",
    transcribeStartDialogOpen: transcribeJob.transcribeStartDialogOpen,
    transcribeStartHasExistingText: transcribeJob.transcribeStartHasExistingText,
    /** @deprecated */
    transcribeOverwriteDialogOpen: transcribeJob.transcribeStartDialogOpen,
    transcribeOverwriteSegmentCount: transcribeJob.overwriteSegmentCount,
    transcribeVocabularyPreflightLines: transcribeJob.transcribeVocabularyPreflightLines,
    transcribeSource: transcribeJob.transcribeSource,
    setTranscribeSource: transcribeJob.setTranscribeSource,
    onlineTranscribeReady: transcribeJob.onlineTranscribeReady,
    refreshProjects, pickAudio, clearPickedAudio,
    createProject: crud.createProject, createEmptyProject: crud.createEmptyProject, createProjectFromText: crud.createProjectFromText,
    loadProject: closeGate.loadProject,
    refreshCurrentProject,
    openFile: closeGate.openFileWrapped,
    restoreEditorFromEditLog,
    openLastEditorWorkspace: closeGate.openLastEditorWorkspace,
    closeFile: closeGate.closeFileWrapped, closeProject: closeGate.closeProjectWrapped,
    runTranscribe: transcribeJob.requestTranscribe,
    cancelTranscribe: transcribeJob.cancelTranscribe,
    confirmTranscribeStart: transcribeJob.confirmTranscribeStart,
    cancelTranscribeStart: transcribeJob.cancelTranscribeStart,
    confirmTranscribeOverwrite: transcribeJob.confirmTranscribeOverwrite,
    cancelTranscribeOverwrite: transcribeJob.cancelTranscribeOverwrite,
    saveSegments,
    confirmSegmentEditAndAdvance,
    getSavedSnapshot: dirty.getSavedSnapshot,
    autoSaveFooterStatus: autoSave.autoSaveFooterStatus,
    ...mapEditorToolsLifecycleFields(editorTools),
    deleteProject: crud.deleteProject,
    exportTxt: exports.exportTxt,
    exportSrt: exports.exportSrt,
    exportDocx: exports.exportDocx,
    exportDeliveryDocx: exports.exportDeliveryDocx,
    exportDiagnosticBundle: exports.exportDiagnosticBundle, exportProjectBundle: exports.exportProjectBundle, importProjectBundle: exports.importProjectBundle,
    openAppDataFolder, applyDetail, setError, beginBusy, endBusy,
    undo: mutations.undo, redo: mutations.redo, updateSegmentText: mutations.updateSegmentText,
    updateSegmentTime: mutations.updateSegmentTime, updateSegmentBounds: mutations.updateSegmentBounds,
    splitAtSelection: () => mutations.splitAtSelection(selectedIdxRef.current),
    splitAtPlayhead: mutations.splitAtPlayhead,
    mergeWithNext: () => mutations.mergeWithNext(selectedIdxRef.current),
    mergeWithPrev: () => mutations.mergeWithPrev(selectedIdxRef.current),
    mergeWithNextAt: mutations.mergeWithNextAt, mergeWithPrevAt: mutations.mergeWithPrevAt,
    deleteSegmentAt: mutations.deleteSegmentAt, insertSegmentAfter: mutations.insertSegmentAfter,
    insertSegmentFromTimeRange: mutations.insertSegmentFromTimeRange,
    flushSegmentTextDrafts: mutations.flushSegmentTextDrafts,
    glossaryLearnDialog: glossaryLearn.glossaryLearnDialog,
    dismissGlossaryLearnPrompt: glossaryLearn.dismissGlossaryLearnPrompt,
    confirmAddToGlossary: (row) => {
      void glossaryLearn.confirmAddToGlossary(row);
    },
    closeGlossaryLearnPrompt: glossaryLearn.closeGlossaryLearnPrompt,
    manualCorrectionMemoryDialog: manualCorrectionMemory.manualCorrectionMemoryDialog,
    openManualCorrectionMemoryDialog: manualCorrectionMemory.openManualCorrectionMemoryDialog,
    closeManualCorrectionMemoryDialog: manualCorrectionMemory.closeManualCorrectionMemoryDialog,
    setManualCorrectionRight: manualCorrectionMemory.setManualCorrectionRight,
    setManualCorrectionAlsoGlossary: manualCorrectionMemory.setManualCorrectionAlsoGlossary,
    confirmManualCorrectionMemory: () => {
      void manualCorrectionMemory.confirmManualCorrectionMemory();
    },
    closeGateOpen: closeGate.closeGateOpen,
    closeGateIntent: closeGate.closeGateIntent,
    stayAfterCloseAttempt: closeGate.stayAfterCloseAttempt,
    discardUnsavedAndClose: () => {
      void closeGate.discardUnsavedAndClose();
    },
    saveAndClose: () => {
      void closeGate.saveAndClose();
    },
  };
}
