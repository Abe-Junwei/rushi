import { useCallback, useRef, useState } from "react";
import { useProjectLifecycleErrorState } from "./projectLifecycleErrorState";
import type { ProjectDetail } from "../tauri/projectApi";
import * as p1 from "../tauri/projectApi";
import { useExportController } from "./useExportController";
import { useProjectBusyState } from "./useProjectBusyState";
import { syncSegmentStagesAfterTranscribeReload } from "../services/segmentStagePersist";
import { useProjectListState } from "./useProjectListState";
import { useProjectEditorState } from "./useProjectEditorState";
import {
  useProjectCloseGateController,
  type ProjectCloseGateControllerApi,
} from "./useProjectCloseGateController";
import { useProjectLifecycleEditorStack } from "./useProjectLifecycleEditorStack";
import { useProjectLifecycleHubStack } from "./useProjectLifecycleHubStack";
import {
  useTranscribeJobController,
  type LocalTranscribePreflight,
} from "./useTranscribeJobController";
import { useProjectEditorToolsController } from "./useProjectEditorToolsController";
import {
  pickCloseGateLifecycleFacade,
  pickExportLifecycleFacade,
} from "./projectLifecycleFacades";
import { buildProjectLifecycleReturn } from "./projectLifecycleReturn";
import type { ProjectLifecycleApi } from "./ProjectLifecycleApi";

export function useProjectLifecycleWiring(
  localTranscribePreflight: LocalTranscribePreflight = () => null,
  sttOnlineRuntimeEpoch = 0,
): ProjectLifecycleApi {
  const { busy, busyReason, beginBusy, endBusy } = useProjectBusyState();
  const { error, setError } = useProjectLifecycleErrorState();
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
    audioStoragePath,
    selectedIdxRef,
    openFile,
    closeFile,
    closeProject,
    refreshCurrentProject: refreshCurrentProjectBase,
    applyDetailBase,
  } = useProjectEditorState(setError);

  const [newName, setNewName] = useState("未命名项目");
  const [pickedPath, setPickedPath] = useState<string | null>(null);
  const closeGateRef = useRef<ProjectCloseGateControllerApi | null>(null);
  const pendingAiRevisedUidsRef = useRef(new Set<string>());

  const editorStack = useProjectLifecycleEditorStack({
    busy,
    beginBusy,
    endBusy,
    setError,
    current,
    currentFileId,
    segments,
    selectedIdx,
    setSelectedIdx,
    selectedIdxRef,
    setCurrent,
    setSegments,
    pendingAiRevisedUidsRef,
  });

  const {
    segmentSelection,
    mutations,
    segmentDeleteConfirm,
    dirty,
    glossaryLearn,
    manualCorrectionMemory,
    saveController,
    saveSegments,
    segmentAnnotation,
    autoSave,
    clearScheduledAutoSave,
    getCurrentSegmentsSnapshot,
    segmentPublish,
  } = editorStack;

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
    segmentPublish,
    setCurrent,
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
    clearScheduledAutoSave,
    onTranscribeSuccess: () => {
      const synced = syncSegmentStagesAfterTranscribeReload(segmentPublish.getCurrentSegmentsSnapshot());
      segmentPublish.publishStructure(synced);
      dirty.setSavedSnapshot(synced);
    },
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
    busyReason,
    cancelTranscribe: transcribeJob.cancelTranscribe,
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

  const { importDuplicate, fileMutation, crud, projectMutation } = useProjectLifecycleHubStack({
    pickedPath,
    newName,
    current,
    busy,
    beginBusy,
    endBusy,
    setError,
    setCurrent,
    setSegments,
    setAudioSrc,
    applyDetail,
    refreshProjects,
    mutations,
    closeGate,
    closeProject,
    setTranscribeHints: transcribeJob.setTranscribeHints,
  });

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

  const editorTools = useProjectEditorToolsController({
    busy,
    busyReason,
    beginBusy,
    endBusy,
    currentFileId,
    selectedIdx,
    segments,
    segmentPublish,
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
    getCurrentSegmentsSnapshot,
    setError,
    flushSegmentTextDrafts: mutations.flushSegmentTextDrafts,
    beginBusy,
    endBusy,
    refreshProjects,
    applyDetail,
  });

  const closeGateFacade = pickCloseGateLifecycleFacade(closeGate, dirty.hasUnsavedSegmentChanges);
  const exportFacade = pickExportLifecycleFacade(exports);

  return buildProjectLifecycleReturn({
    projects,
    current,
    currentFileId,
    segments,
    selectedIdx,
    setSelectedIdx,
    audioSrc,
    audioStoragePath,
    error,
    busy,
    busyReason,
    newName,
    setNewName,
    pickedPath,
    refreshProjects,
    pickAudio,
    clearPickedAudio,
    refreshCurrentProject,
    openAppDataFolder,
    applyDetail,
    setError,
    beginBusy,
    endBusy,
    selectedIdxRef,
    getCurrentSegmentsSnapshot,
    closeGateFacade,
    exportFacade,
    transcribeJob,
    editorTools,
    crud,
    saveController,
    autoSave,
    dirty,
    mutations,
    segmentSelection,
    segmentDeleteConfirm,
    glossaryLearn,
    manualCorrectionMemory,
    importDuplicate,
    fileMutation,
    projectMutation,
    segmentAnnotation,
  });
}
