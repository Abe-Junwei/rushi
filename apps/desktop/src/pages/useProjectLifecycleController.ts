import { useCallback, useRef, useState } from "react";
import type { ProjectDetail } from "../tauri/projectApi";
import * as p1 from "../tauri/projectApi";
import * as fileApi from "../tauri/fileApi";
import { useExportController } from "./useExportController";
import { useProjectCrudController } from "./useProjectCrudController";
import { useSegmentMutationController } from "./useSegmentMutationController";
import { useProjectBusyState } from "./useProjectBusyState";
import { useProjectListState } from "./useProjectListState";
import { useProjectEditorState } from "./useProjectEditorState";
import { useAutoPunctuateController } from "./useAutoPunctuateController";
import { useLlmKeychainReady } from "../hooks/useLlmKeychainReady";
import {
  useProjectCloseGateController,
  type ProjectCloseGateControllerApi,
} from "./useProjectCloseGateController";
import { useSegmentDirtyState } from "./useSegmentDirtyState";
import {
  useTranscribeJobController,
  type LocalTranscribePreflight,
} from "./useTranscribeJobController";
import { findSegmentIndexByUid, normalizeSegmentList, prepareSegmentsForPersist } from "./segmentListHelpers";
import type { ProjectLifecycleApi } from "./ProjectLifecycleApi";

export type { ProjectLifecycleApi } from "./ProjectLifecycleApi";
export type { BusyReason } from "./useProjectCrudController";
export type { LocalTranscribePreflight };

export function useProjectLifecycleController(
  localTranscribePreflight: LocalTranscribePreflight = () => null,
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

  const saveSegments = useCallback(async (): Promise<boolean> => {
    if (busy || !current || !currentFileId) {
      setError("请先打开一个文件后再保存");
      return false;
    }
    beginBusy("save");
    setError("");
    try {
      mutations.flushSegmentTextDrafts();
      const normalized = prepareSegmentsForPersist(segmentsRef.current, 0);
      await fileApi.fileSaveSegments(currentFileId, normalized);
      const [projectDetail, fileDetail] = await Promise.all([
        p1.projectLoad(current.id),
        fileApi.loadFile(currentFileId),
      ]);
      setCurrent(projectDetail);
      const prevUid = segmentsRef.current[selectedIdxRef.current]?.uid;
      const segs = normalizeSegmentList(fileDetail.segments);
      segmentsRef.current = segs;
      setSegments(segs);
      dirty.setSavedSnapshot(segs);
      const ni = findSegmentIndexByUid(segs, prevUid);
      setSelectedIdx(
        ni >= 0 ? ni : Math.min(selectedIdxRef.current, Math.max(0, segs.length - 1)),
      );
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      endBusy();
    }
  }, [busy, current, currentFileId, mutations, dirty, beginBusy, endBusy, setCurrent, setSegments, setSelectedIdx, segmentsRef, selectedIdxRef]);

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
    resetMutationHistory: mutations.resetMutationHistory,
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

  const [llmRuntimeEpoch, setLlmRuntimeEpoch] = useState(0);
  const bumpLlmRuntimeChanged = useCallback(() => {
    setLlmRuntimeEpoch((n) => n + 1);
  }, []);
  const { keychainReady: llmKeychainReady, checking: llmKeychainChecking } =
    useLlmKeychainReady(llmRuntimeEpoch);

  const autoPunctuate = useAutoPunctuateController({
    busy,
    transcribePreviewActive: busy && busyReason === "transcribe",
    currentFileId,
    selectedIdx,
    segments,
    segmentsRef,
    flushSegmentTextDrafts: mutations.flushSegmentTextDrafts,
    updateSegmentText: mutations.updateSegmentText,
    setError,
    llmRuntimeEpoch,
    llmKeychainReady,
    llmKeychainChecking,
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
    transcribeOverwriteDialogOpen: transcribeJob.overwriteDialogOpen,
    transcribeOverwriteSegmentCount: transcribeJob.overwriteSegmentCount,
    refreshProjects, pickAudio, clearPickedAudio,
    createProject: crud.createProject, createEmptyProject: crud.createEmptyProject, createProjectFromText: crud.createProjectFromText,
    loadProject: closeGate.loadProject, refreshCurrentProject, openFile: closeGate.openFileWrapped,
    closeFile: closeGate.closeFileWrapped, closeProject: closeGate.closeProjectWrapped,
    runTranscribe: transcribeJob.requestTranscribe,
    cancelTranscribe: transcribeJob.cancelTranscribe,
    confirmTranscribeOverwrite: transcribeJob.confirmTranscribeOverwrite,
    cancelTranscribeOverwrite: transcribeJob.cancelTranscribeOverwrite,
    saveSegments, deleteProject: crud.deleteProject,
    exportTxt: exports.exportTxt, exportSrt: exports.exportSrt, exportDocx: exports.exportDocx,
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
    canAutoPunctuate: autoPunctuate.canAutoPunctuate,
    autoPunctuateBlockReason: autoPunctuate.autoPunctuateBlockReason,
    autoPunctuateDialog: autoPunctuate.dialog,
    requestAutoPunctuate: autoPunctuate.requestAutoPunctuate,
    confirmAutoPunctuateConsent: autoPunctuate.confirmAutoPunctuateConsent,
    confirmAutoPunctuateWriteback: autoPunctuate.confirmAutoPunctuateWriteback,
    cancelAutoPunctuate: autoPunctuate.cancelAutoPunctuate,
    bumpLlmRuntimeChanged,
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
