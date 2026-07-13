import { convertFileSrc } from "@tauri-apps/api/core";
import { useCallback, useRef, useState } from "react";
import type { ProjectDetail, SegmentDto } from "../tauri/projectApi";
import * as p1 from "../tauri/projectApi";
import * as fileApi from "../tauri/fileApi";
import { findSegmentIndexByUid, normalizeSegmentList } from "./segmentListHelpers";
import { dispatchTranscriptEditorSelection } from "../components/editor/core/transcriptEditorViewHandle";
import { readFileViewState } from "../services/fileViewState";
import { armFileViewRestore, clearFileViewRestore } from "../services/fileViewStateBridge";
import { logDesktopUi } from "../services/desktopUiLog";

export interface ProjectEditorApi {
  current: ProjectDetail | null;
  setCurrent: React.Dispatch<React.SetStateAction<ProjectDetail | null>>;
  currentFileId: string | null;
  setCurrentFileId: React.Dispatch<React.SetStateAction<string | null>>;
  segments: SegmentDto[];
  setSegments: React.Dispatch<React.SetStateAction<SegmentDto[]>>;
  /** @deprecated Prefer projection primary; kept as ref mirror for sync reads. */
  selectedIdx: number;
  setSelectedIdx: (idx: number) => void;
  audioSrc: string | null;
  /** Raw on-disk audio path (Tauri invoke → blob URL for WaveSurfer). */
  audioStoragePath: string | null;
  setAudioSrc: React.Dispatch<React.SetStateAction<string | null>>;
  selectedIdxRef: React.MutableRefObject<number>;
  openFile: (fileId: string) => Promise<SegmentDto[] | null>;
  closeFile: () => void;
  closeProject: () => void;
  refreshCurrentProject: () => Promise<void>;
  applyDetailBase: (d: ProjectDetail) => void;
}

export function useProjectEditorState(setError: (msg: string) => void): ProjectEditorApi {
  const [current, setCurrent] = useState<ProjectDetail | null>(null);
  const [currentFileId, setCurrentFileId] = useState<string | null>(null);
  const [segments, setSegments] = useState<SegmentDto[]>([]);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [audioStoragePath, setAudioStoragePath] = useState<string | null>(null);

  const selectedIdxRef = useRef(0);

  const setSelectedIdx = useCallback((idx: number) => {
    selectedIdxRef.current = idx;
    dispatchTranscriptEditorSelection(idx);
  }, []);

  const openFile = useCallback(async (fileId: string): Promise<SegmentDto[] | null> => {
    setError("");
    try {
      const detail = await fileApi.loadFile(fileId);
      const segs = normalizeSegmentList(detail.segments);
      const saved = readFileViewState(fileId);
      const ni = findSegmentIndexByUid(segs, saved?.selectedSegmentUid);
      const nextIdx = ni >= 0 ? ni : 0;
      setCurrentFileId(fileId);
      setSegments(segs);
      selectedIdxRef.current = nextIdx;
      dispatchTranscriptEditorSelection(nextIdx);
      if (saved) {
        logDesktopUi(
          "INFO",
          `[fvsr] arm file=${fileId} playhead=${saved.playheadSec.toFixed(2)} nextIdx=${nextIdx}`,
        );
        armFileViewRestore(fileId, saved);
      } else {
        logDesktopUi("INFO", `[fvsr] no-arm file=${fileId} (no saved state)`);
        clearFileViewRestore();
      }
      try {
        setAudioStoragePath(detail.audio_path ?? null);
        setAudioSrc(detail.audio_path ? convertFileSrc(detail.audio_path) : null);
      } catch {
        setAudioStoragePath(null);
        setAudioSrc(null);
      }
      return segs;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    }
  }, [setError]);

  const closeFile = useCallback(() => {
    setCurrentFileId(null);
    setSegments([]);
    selectedIdxRef.current = 0;
    setAudioSrc(null);
    setAudioStoragePath(null);
    clearFileViewRestore();
  }, []);

  const closeProject = useCallback(() => {
    setCurrent(null);
    closeFile();
  }, [closeFile]);

  const refreshCurrentProject = useCallback(async () => {
    if (!current) return;
    setError("");
    try {
      const d = await p1.projectLoad(current.id);
      setCurrent(d);
      if (currentFileId) {
        const fd = await fileApi.loadFile(currentFileId);
        const prevUid = segments[selectedIdxRef.current]?.uid;
        const segs = normalizeSegmentList(fd.segments);
        setSegments(segs);
        const ni = findSegmentIndexByUid(segs, prevUid);
        const nextIdx = ni >= 0 ? ni : Math.min(selectedIdxRef.current, Math.max(0, segs.length - 1));
        setSelectedIdx(nextIdx);
        try {
          setAudioStoragePath(fd.audio_path ?? null);
          setAudioSrc(fd.audio_path ? convertFileSrc(fd.audio_path) : null);
        } catch {
          setAudioStoragePath(null);
          setAudioSrc(null);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [current, currentFileId, segments, setError, setSelectedIdx]);

  const applyDetailBase = useCallback((d: ProjectDetail) => {
    setCurrent(d);
  }, []);

  return {
    current,
    setCurrent,
    currentFileId,
    setCurrentFileId,
    segments,
    setSegments,
    selectedIdx: selectedIdxRef.current,
    setSelectedIdx,
    audioSrc,
    setAudioSrc,
    audioStoragePath,
    selectedIdxRef,
    openFile,
    closeFile,
    closeProject,
    refreshCurrentProject,
    applyDetailBase,
  };
}
