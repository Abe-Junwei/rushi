import { convertFileSrc } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { asrBaseUrl } from "../config/env";
import { deriveTranscribeHints } from "../services/asrTranscribeHints";
import { isSttOnlineEnabledButIncomplete, tryBuildOnlineTranscribeBridgePayload } from "../services/stt/sttOnlineProviderContract";
import type { ProjectDetail, ProjectSummary, SegmentDto } from "../tauri/projectApi";
import * as p1 from "../tauri/projectApi";
import * as fileApi from "../tauri/fileApi";
import { type DocxExportMode } from "../tauri/exportDocxApi";
import { useExportController } from "./useExportController";
import { useProjectCrudController, type BusyReason } from "./useProjectCrudController";
import { useSegmentMutationController } from "./useSegmentMutationController";

export type { BusyReason };
type BusyPack = { busy: boolean; reason: BusyReason | null };

function cloneSegments(segs: SegmentDto[]): SegmentDto[] {
  return segs.map((s) => ({ ...s }));
}

export interface ProjectLifecycleApi {
  projects: ProjectSummary[];
  current: ProjectDetail | null;
  currentFileId: string | null;
  segments: SegmentDto[];
  selectedIdx: number;
  setSelectedIdx: React.Dispatch<React.SetStateAction<number>>;
  audioSrc: string | null;
  error: string;
  busy: boolean;
  busyReason: BusyReason | null;
  newName: string;
  setNewName: React.Dispatch<React.SetStateAction<string>>;
  pickedPath: string | null;
  transcribeHints: string[];
  refreshProjects: () => Promise<void>;
  pickAudio: () => Promise<void>;
  clearPickedAudio: () => void;
  createProject: () => Promise<void>;
  createEmptyProject: () => Promise<void>;
  createProjectFromText: () => Promise<void>;
  loadProject: (id: string) => Promise<void>;
  openFile: (fileId: string) => Promise<void>;
  closeFile: () => void;
  closeProject: () => void;
  refreshCurrentProject: () => Promise<void>;
  runTranscribe: () => Promise<void>;
  saveSegments: () => Promise<void>;
  deleteProject: (id: string, options?: { skipBrowserConfirm?: boolean }) => Promise<void>;
  exportTxt: () => Promise<void>;
  exportSrt: () => Promise<void>;
  exportDocx: (mode: DocxExportMode) => Promise<void>;
  exportDiagnosticBundle: () => Promise<void>;
  exportProjectBundle: () => Promise<void>;
  importProjectBundle: () => Promise<void>;
  openAppDataFolder: () => Promise<void>;
  applyDetail: (d: ProjectDetail) => void;
  setError: React.Dispatch<React.SetStateAction<string>>;
  beginBusy: (reason: BusyReason) => void;
  endBusy: () => void;

  undo: () => void;
  redo: () => void;
  updateSegmentText: (idx: number, text: string) => void;
  updateSegmentTime: (idx: number, field: "start_sec" | "end_sec", value: number) => void;
  updateSegmentBounds: (idx: number, startSec: number, endSec: number, phase?: "live" | "commit") => void;
  splitAtSelection: () => void;
  splitAtPlayhead: (timeSec: number) => void;
  mergeWithNext: () => void;
  mergeWithPrev: () => void;
  mergeWithNextAt: (idx: number) => void;
  mergeWithPrevAt: (idx: number) => void;
  deleteSegmentAt: (idx: number) => void;
  insertSegmentAfter: (idx: number) => void;
  insertSegmentFromTimeRange: (startSec: number, endSec: number) => void;
  flushSegmentTextDraftsFromDom: () => void;
  attachSegmentListDomRoot: (getter: (() => HTMLElement | null) | null) => void;
}

export function useProjectLifecycleController(): ProjectLifecycleApi {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [current, setCurrent] = useState<ProjectDetail | null>(null);
  const [currentFileId, setCurrentFileId] = useState<string | null>(null);
  const [segments, setSegments] = useState<SegmentDto[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [error, setError] = useState<string>("");
  const [busyPack, setBusyPack] = useState<BusyPack>({ busy: false, reason: null });
  const [newName, setNewName] = useState("未命名项目");
  const [pickedPath, setPickedPath] = useState<string | null>(null);
  const [transcribeHints, setTranscribeHints] = useState<string[]>([]);

  const busy = busyPack.busy;
  const busyReason = busyPack.reason;
  const beginBusy = useCallback((reason: BusyReason) => {
    setBusyPack({ busy: true, reason });
  }, []);
  const endBusy = useCallback(() => {
    setBusyPack({ busy: false, reason: null });
  }, []);

  const segmentsRef = useRef(segments);
  segmentsRef.current = segments;
  const selectedIdxRef = useRef(selectedIdx);
  selectedIdxRef.current = selectedIdx;

  const getSegmentListRootRef = useRef<(() => HTMLElement | null) | null>(null);
  const getSegmentListRoot = useCallback(() => getSegmentListRootRef.current?.() ?? null, []);
  const attachSegmentListDomRoot = useCallback((getter: (() => HTMLElement | null) | null) => {
    getSegmentListRootRef.current = getter;
  }, []);

  const mutations = useSegmentMutationController({
    segmentsRef,
    setSegments,
    selectedIdxRef,
    setSelectedIdx,
    setError,
    busy,
    getSegmentListRoot,
  });

  const refreshProjects = useCallback(async () => {
    try {
      setError("");
      const list = await p1.projectList();
      setProjects(list);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (message.includes("reading 'invoke'")) {
        setProjects([]);
        return;
      }
      setError(message);
    }
  }, []);

  useEffect(() => {
    void refreshProjects();
  }, [refreshProjects]);

  const applyDetail = useCallback((d: ProjectDetail) => {
    mutations.resetMutationHistory();
    setCurrent(d);
    setTranscribeHints([]);
    setPickedPath(null);
  }, [mutations]);

  const openFile = useCallback(async (fileId: string) => {
    beginBusy("load");
    setError("");
    try {
      const detail = await fileApi.loadFile(fileId);
      setCurrentFileId(fileId);
      setSegments(cloneSegments(detail.segments));
      setSelectedIdx(0);
      try {
        setAudioSrc(detail.audio_path ? convertFileSrc(detail.audio_path) : null);
      } catch {
        setAudioSrc(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      endBusy();
    }
  }, [beginBusy, endBusy]);

  const closeFile = useCallback(() => {
    setCurrentFileId(null);
    setSegments([]);
    setSelectedIdx(0);
    setAudioSrc(null);
    mutations.resetMutationHistory();
  }, [mutations]);

  const closeProject = useCallback(() => {
    setCurrent(null);
    closeFile();
  }, [closeFile]);

  const loadProject = useCallback(async (id: string) => {
    setError("");
    try {
      const d = await p1.projectLoad(id);
      applyDetail(d);
      if (d.files && d.files.length > 0) {
        const sorted = [...d.files].sort((a, b) => b.updated_at_ms - a.updated_at_ms);
        await openFile(sorted[0].id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [applyDetail, openFile, setError]);

  const refreshCurrentProject = useCallback(async () => {
    if (!current) return;
    setError("");
    try {
      const d = await p1.projectLoad(current.id);
      setCurrent(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [current, setError]);

  const pickAudio = useCallback(async () => {
    setError("");
    try {
      const p = await p1.pickAudioPath();
      setPickedPath(p ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

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
    if (!current) return;
    if (isSttOnlineEnabledButIncomplete()) {
      setError(
        "已启用在线 STT：请在「环境与 ASR」中选择厂商、填写 API Key 并点击保存在线配置；自建网关还须填写 HTTPS 转写 URL。OpenAI / AssemblyAI 可留空 URL 使用默认端点。",
      );
      return;
    }
    beginBusy("transcribe");
    setError("");
    setTranscribeHints([]);
    try {
      const online = tryBuildOnlineTranscribeBridgePayload();
      const out = await p1.projectRunTranscribe(current.id, asrBaseUrl(), online ?? null);
      applyDetail(out.detail);
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
  }, [current, applyDetail, beginBusy, endBusy]);

  const saveSegments = useCallback(async () => {
    if (!current) return;
    beginBusy("save");
    setError("");
    try {
      mutations.flushSegmentTextDraftsFromDom();
      const normalized = segmentsRef.current.map((s, i) => ({ ...s, idx: i }));
      await p1.projectSaveSegments(current.id, normalized);
      const d = await p1.projectLoad(current.id);
      applyDetail(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      endBusy();
    }
  }, [current, applyDetail, mutations, beginBusy, endBusy]);

  const openAppDataFolder = async () => {
    setError("");
    try {
      await p1.openAppDataFolder();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const exports = useExportController({
    current,
    segmentsRef,
    setError,
    flushSegmentTextDraftsFromDom: mutations.flushSegmentTextDraftsFromDom,
    refreshProjects,
    applyDetail,
  });

  return {
    projects,
    current,
    currentFileId,
    segments,
    selectedIdx,
    setSelectedIdx,
    audioSrc,
    error,
    busy,
    busyReason,
    newName,
    setNewName,
    pickedPath,
    transcribeHints,
    refreshProjects,
    pickAudio,
    clearPickedAudio,
    createProject: crud.createProject,
    createEmptyProject: crud.createEmptyProject,
    createProjectFromText: crud.createProjectFromText,
    loadProject,
    refreshCurrentProject,
    openFile,
    closeFile,
    closeProject,
    runTranscribe,
    saveSegments,
    deleteProject: crud.deleteProject,
    exportTxt: exports.exportTxt,
    exportSrt: exports.exportSrt,
    exportDocx: exports.exportDocx,
    exportDiagnosticBundle: exports.exportDiagnosticBundle,
    exportProjectBundle: exports.exportProjectBundle,
    importProjectBundle: exports.importProjectBundle,
    openAppDataFolder,
    applyDetail,
    setError,
    beginBusy,
    endBusy,

    undo: mutations.undo,
    redo: mutations.redo,
    updateSegmentText: mutations.updateSegmentText,
    updateSegmentTime: mutations.updateSegmentTime,
    updateSegmentBounds: mutations.updateSegmentBounds,
    splitAtSelection: () => mutations.splitAtSelection(selectedIdx),
    splitAtPlayhead: mutations.splitAtPlayhead,
    mergeWithNext: () => mutations.mergeWithNext(selectedIdx),
    mergeWithPrev: () => mutations.mergeWithPrev(selectedIdx),
    mergeWithNextAt: mutations.mergeWithNextAt,
    mergeWithPrevAt: mutations.mergeWithPrevAt,
    deleteSegmentAt: mutations.deleteSegmentAt,
    insertSegmentAfter: mutations.insertSegmentAfter,
    insertSegmentFromTimeRange: mutations.insertSegmentFromTimeRange,
    flushSegmentTextDraftsFromDom: mutations.flushSegmentTextDraftsFromDom,
    attachSegmentListDomRoot,
  };
}
