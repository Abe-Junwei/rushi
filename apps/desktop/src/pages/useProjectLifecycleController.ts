import { convertFileSrc } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { asrBaseUrl } from "../config/env";
import { deriveTranscribeHints } from "../services/asrTranscribeHints";
import { isSttOnlineEnabledButIncomplete, tryBuildP1OnlineTranscribeBridgePayload } from "../services/stt/sttOnlineProviderContract";
import type { ProjectDetail, ProjectSummary, SegmentDto } from "../tauri/p1Api";
import * as p1 from "../tauri/p1Api";
import { type P3DocxExportMode } from "../tauri/p3ExportDocxApi";
import { useP1ExportController } from "./useP1ExportController";
import { useProjectCrudController, type P1BusyReason } from "./useProjectCrudController";
import { useSegmentMutationController } from "./useSegmentMutationController";

export type { P1BusyReason };
type P1BusyPack = { busy: boolean; reason: P1BusyReason | null };

function cloneSegments(segs: SegmentDto[]): SegmentDto[] {
  return segs.map((s) => ({ ...s }));
}

export interface ProjectLifecycleApi {
  projects: ProjectSummary[];
  current: ProjectDetail | null;
  segments: SegmentDto[];
  selectedIdx: number;
  setSelectedIdx: React.Dispatch<React.SetStateAction<number>>;
  audioSrc: string | null;
  error: string;
  busy: boolean;
  busyReason: P1BusyReason | null;
  newName: string;
  setNewName: React.Dispatch<React.SetStateAction<string>>;
  pickedPath: string | null;
  transcribeHints: string[];
  refreshProjects: () => Promise<void>;
  pickAudio: () => Promise<void>;
  clearPickedAudio: () => void;
  createProject: () => Promise<void>;
  loadProject: (id: string) => Promise<void>;
  runTranscribe: () => Promise<void>;
  saveSegments: () => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  exportTxt: () => Promise<void>;
  exportSrt: () => Promise<void>;
  exportDocx: (mode: P3DocxExportMode) => Promise<void>;
  exportDiagnosticBundle: () => Promise<void>;
  openAppDataFolder: () => Promise<void>;
  applyDetail: (d: ProjectDetail) => void;
  setError: React.Dispatch<React.SetStateAction<string>>;
  beginBusy: (reason: P1BusyReason) => void;
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
  flushP1SegmentTextDraftsFromDom: () => void;
}

export function useProjectLifecycleController(): ProjectLifecycleApi {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [current, setCurrent] = useState<ProjectDetail | null>(null);
  const [segments, setSegments] = useState<SegmentDto[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [error, setError] = useState<string>("");
  const [busyPack, setBusyPack] = useState<P1BusyPack>({ busy: false, reason: null });
  const [newName, setNewName] = useState("未命名项目");
  const [pickedPath, setPickedPath] = useState<string | null>(null);
  const [transcribeHints, setTranscribeHints] = useState<string[]>([]);

  const busy = busyPack.busy;
  const busyReason = busyPack.reason;
  const beginBusy = useCallback((reason: P1BusyReason) => {
    setBusyPack({ busy: true, reason });
  }, []);
  const endBusy = useCallback(() => {
    setBusyPack({ busy: false, reason: null });
  }, []);

  const segmentsRef = useRef(segments);
  segmentsRef.current = segments;
  const selectedIdxRef = useRef(selectedIdx);
  selectedIdxRef.current = selectedIdx;

  const mutations = useSegmentMutationController({
    segmentsRef,
    setSegments,
    selectedIdxRef,
    setSelectedIdx,
    setError,
    busy,
  });

  const refreshProjects = useCallback(async () => {
    try {
      setError("");
      const list = await p1.p1ProjectList();
      setProjects(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void refreshProjects();
  }, [refreshProjects]);

  const applyDetail = useCallback((d: ProjectDetail) => {
    mutations.resetMutationHistory();
    setCurrent(d);
    setSegments(cloneSegments(d.segments));
    setSelectedIdx(0);
    setTranscribeHints([]);
    setPickedPath(null);
    try {
      setAudioSrc(convertFileSrc(d.audio_storage_path));
    } catch {
      setAudioSrc(null);
    }
  }, [mutations]);

  const pickAudio = useCallback(async () => {
    setError("");
    try {
      const p = await p1.p1PickAudioPath();
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
      const online = tryBuildP1OnlineTranscribeBridgePayload();
      const out = await p1.p1ProjectRunTranscribe(current.id, asrBaseUrl(), online ?? null);
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
      mutations.flushP1SegmentTextDraftsFromDom();
      const normalized = segmentsRef.current.map((s, i) => ({ ...s, idx: i }));
      await p1.p1ProjectSaveSegments(current.id, normalized);
      const d = await p1.p1ProjectLoad(current.id);
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
      await p1.p1OpenAppDataFolder();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const exports = useP1ExportController({
    current,
    segmentsRef,
    setError,
    flushP1SegmentTextDraftsFromDom: mutations.flushP1SegmentTextDraftsFromDom,
  });

  return {
    projects,
    current,
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
    loadProject: crud.loadProject,
    runTranscribe,
    saveSegments,
    deleteProject: crud.deleteProject,
    exportTxt: exports.exportTxt,
    exportSrt: exports.exportSrt,
    exportDocx: exports.exportDocx,
    exportDiagnosticBundle: exports.exportDiagnosticBundle,
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
    flushP1SegmentTextDraftsFromDom: mutations.flushP1SegmentTextDraftsFromDom,
  };
}
