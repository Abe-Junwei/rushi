import { useCallback, useState } from "react";
import { asrBaseUrl } from "../config/env";
import { deriveTranscribeHints } from "../services/asrTranscribeHints";
import {
  isSttOnlineEnabledButIncomplete,
  tryBuildOnlineTranscribeBridgePayload,
} from "../services/stt/sttOnlineProviderContract";
import type { ProjectDetail } from "../tauri/projectApi";
import * as p1 from "../tauri/projectApi";
import * as fileApi from "../tauri/fileApi";
import { useExportController } from "./useExportController";
import { useProjectCrudController } from "./useProjectCrudController";
import { useSegmentMutationController } from "./useSegmentMutationController";
import { useProjectBusyState } from "./useProjectBusyState";
import { useProjectListState } from "./useProjectListState";
import { useProjectEditorState } from "./useProjectEditorState";
import { useSegmentDirtyState } from "./useSegmentDirtyState";
import { cloneSegments } from "./segmentListHelpers";
import type { ProjectLifecycleApi } from "./ProjectLifecycleApi";

export type { ProjectLifecycleApi } from "./ProjectLifecycleApi";
export type { BusyReason } from "./useProjectCrudController";

export function useProjectLifecycleController(): ProjectLifecycleApi {
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
    getSegmentListRoot,
    attachSegmentListDomRoot,
    openFile,
    closeFile,
    refreshCurrentProject: refreshCurrentProjectBase,
    applyDetailBase,
  } = useProjectEditorState(setError);

  const [newName, setNewName] = useState("未命名项目");
  const [pickedPath, setPickedPath] = useState<string | null>(null);
  const [transcribeHints, setTranscribeHints] = useState<string[]>([]);

  const mutations = useSegmentMutationController({
    segmentsRef,
    setSegments,
    selectedIdxRef,
    setSelectedIdx,
    setError,
    busy,
    getSegmentListRoot,
  });

  const dirty = useSegmentDirtyState({
    currentFileId,
    segmentsRef,
    flushSegmentTextDraftsFromDom: mutations.flushSegmentTextDraftsFromDom,
  });

  const applyDetail = useCallback(
    (d: ProjectDetail) => {
      mutations.resetMutationHistory();
      applyDetailBase(d);
      setTranscribeHints([]);
      setPickedPath(null);
    },
    [mutations, applyDetailBase],
  );

  const closeFileWrapped = useCallback(() => {
    closeFile();
    dirty.clearSavedSnapshot();
    mutations.resetMutationHistory();
  }, [closeFile, dirty, mutations]);

  const closeProjectWrapped = useCallback(() => {
    if (!dirty.confirmDiscardUnsavedIfNeeded()) return;
    setCurrent(null);
    closeFileWrapped();
    setTranscribeHints([]);
  }, [dirty, closeFileWrapped, setCurrent]);

  const openFileWrapped = useCallback(
    async (fileId: string) => {
      if (
        currentFileId &&
        fileId !== currentFileId &&
        !dirty.confirmDiscardUnsavedIfNeeded()
      ) {
        return;
      }
      await openFile(fileId);
      dirty.markSegmentsSaved();
    },
    [currentFileId, dirty, openFile],
  );

  const loadProject = useCallback(
    async (id: string) => {
      if (busy) return;
      if (current?.id !== id && !dirty.confirmDiscardUnsavedIfNeeded()) return;
      setError("");
      beginBusy("load");
      try {
        const d = await p1.projectLoad(id);
        applyDetail(d);
        if (d.files && d.files.length > 0) {
          const sorted = [...d.files].sort((a, b) => b.updated_at_ms - a.updated_at_ms);
          await openFileWrapped(sorted[0].id);
        } else {
          dirty.clearSavedSnapshot();
        }
      } catch (e) {
        setCurrent(null);
        closeFileWrapped();
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        endBusy();
      }
    },
    [busy, current?.id, dirty, applyDetail, openFileWrapped, beginBusy, endBusy, closeFileWrapped, setCurrent],
  );

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
    setTranscribeHints,
  });

  const runTranscribe = useCallback(async () => {
    if (busy || !current || !currentFileId) {
      if (!busy && current && !currentFileId) {
        setError("请先打开一个文件后再拉取语段");
      }
      return;
    }
    if (isSttOnlineEnabledButIncomplete()) {
      setError(
        "已启用在线 STT：请在「环境与 ASR」中选择厂商、填写 API Key 并点击保存在线配置；自建网关还须填写 HTTPS 转写 URL。OpenAI / AssemblyAI 可留空 URL 使用默认端点。",
      );
      return;
    }
    const fileId = currentFileId;
    beginBusy("transcribe");
    setError("");
    setTranscribeHints([]);
    try {
      const online = tryBuildOnlineTranscribeBridgePayload();
      const out = await p1.projectRunTranscribe(fileId, asrBaseUrl(), online ?? null);
      mutations.resetMutationHistory();
      const projectDetail = await p1.projectLoad(current.id);
      setCurrent(projectDetail);
      await openFileWrapped(fileId);
      const hints = deriveTranscribeHints(out.engine, out.warnings, out.detail.segments);
      if (import.meta.env.DEV && hints.length > 0) {
        hints.push("（开发模式）详见仓库 services/asr/README.md。");
      }
      setTranscribeHints(hints);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      endBusy();
    }
  }, [busy, current, currentFileId, mutations, openFileWrapped, beginBusy, endBusy, setCurrent]);

  const saveSegments = useCallback(async () => {
    if (busy || !current || !currentFileId) {
      setError("请先打开一个文件后再保存");
      return;
    }
    beginBusy("save");
    setError("");
    try {
      mutations.flushSegmentTextDraftsFromDom();
      const normalized = segmentsRef.current.map((s, i) => ({ ...s, idx: i }));
      await fileApi.fileSaveSegments(currentFileId, normalized);
      const [projectDetail, fileDetail] = await Promise.all([
        p1.projectLoad(current.id),
        fileApi.loadFile(currentFileId),
      ]);
      setCurrent(projectDetail);
      setSegments(cloneSegments(fileDetail.segments));
      dirty.setSavedSnapshot(fileDetail.segments);
      setSelectedIdx((prev) => Math.min(prev, Math.max(0, fileDetail.segments.length - 1)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      endBusy();
    }
  }, [busy, current, currentFileId, mutations, dirty, beginBusy, endBusy, setCurrent, setSegments, setSelectedIdx, segmentsRef]);

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
    flushSegmentTextDraftsFromDom: mutations.flushSegmentTextDraftsFromDom,
    refreshProjects,
    applyDetail,
  });

  return {
    projects, current, currentFileId, segments, selectedIdx, setSelectedIdx,
    audioSrc, error, busy, busyReason, newName, setNewName, pickedPath, transcribeHints,
    refreshProjects, pickAudio, clearPickedAudio,
    createProject: crud.createProject, createEmptyProject: crud.createEmptyProject, createProjectFromText: crud.createProjectFromText,
    loadProject, refreshCurrentProject, openFile: openFileWrapped, closeFile: closeFileWrapped, closeProject: closeProjectWrapped,
    runTranscribe, saveSegments, deleteProject: crud.deleteProject,
    exportTxt: exports.exportTxt, exportSrt: exports.exportSrt, exportDocx: exports.exportDocx,
    exportDiagnosticBundle: exports.exportDiagnosticBundle, exportProjectBundle: exports.exportProjectBundle, importProjectBundle: exports.importProjectBundle,
    openAppDataFolder, applyDetail, setError, beginBusy, endBusy,
    undo: mutations.undo, redo: mutations.redo, updateSegmentText: mutations.updateSegmentText,
    updateSegmentTime: mutations.updateSegmentTime, updateSegmentBounds: mutations.updateSegmentBounds,
    splitAtSelection: () => mutations.splitAtSelection(selectedIdx), splitAtPlayhead: mutations.splitAtPlayhead,
    mergeWithNext: () => mutations.mergeWithNext(selectedIdx), mergeWithPrev: () => mutations.mergeWithPrev(selectedIdx),
    mergeWithNextAt: mutations.mergeWithNextAt, mergeWithPrevAt: mutations.mergeWithPrevAt,
    deleteSegmentAt: mutations.deleteSegmentAt, insertSegmentAfter: mutations.insertSegmentAfter,
    insertSegmentFromTimeRange: mutations.insertSegmentFromTimeRange,
    flushSegmentTextDraftsFromDom: mutations.flushSegmentTextDraftsFromDom,
    attachSegmentListDomRoot,
  };
}
