import { convertFileSrc } from "@tauri-apps/api/core";
import { useCallback, useRef, useState } from "react";
import type { ProjectDetail, SegmentDto } from "../tauri/projectApi";
import * as p1 from "../tauri/projectApi";
import * as fileApi from "../tauri/fileApi";
import { cloneSegments } from "./segmentListHelpers";

export interface ProjectEditorApi {
  current: ProjectDetail | null;
  setCurrent: React.Dispatch<React.SetStateAction<ProjectDetail | null>>;
  currentFileId: string | null;
  setCurrentFileId: React.Dispatch<React.SetStateAction<string | null>>;
  segments: SegmentDto[];
  setSegments: React.Dispatch<React.SetStateAction<SegmentDto[]>>;
  selectedIdx: number;
  setSelectedIdx: React.Dispatch<React.SetStateAction<number>>;
  audioSrc: string | null;
  setAudioSrc: React.Dispatch<React.SetStateAction<string | null>>;
  segmentsRef: React.MutableRefObject<SegmentDto[]>;
  selectedIdxRef: React.MutableRefObject<number>;
  getSegmentListRoot: () => HTMLElement | null;
  attachSegmentListDomRoot: (getter: (() => HTMLElement | null) | null) => void;
  openFile: (fileId: string) => Promise<void>;
  closeFile: () => void;
  closeProject: () => void;
  refreshCurrentProject: () => Promise<void>;
  applyDetailBase: (d: ProjectDetail) => void;
}

export function useProjectEditorState(setError: (msg: string) => void): ProjectEditorApi {
  const [current, setCurrent] = useState<ProjectDetail | null>(null);
  const [currentFileId, setCurrentFileId] = useState<string | null>(null);
  const [segments, setSegments] = useState<SegmentDto[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);

  const segmentsRef = useRef(segments);
  segmentsRef.current = segments;
  const selectedIdxRef = useRef(selectedIdx);
  selectedIdxRef.current = selectedIdx;

  const getSegmentListRootRef = useRef<(() => HTMLElement | null) | null>(null);
  const getSegmentListRoot = useCallback(() => getSegmentListRootRef.current?.() ?? null, []);
  const attachSegmentListDomRoot = useCallback((getter: (() => HTMLElement | null) | null) => {
    getSegmentListRootRef.current = getter;
  }, []);

  const openFile = useCallback(async (fileId: string) => {
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
    }
  }, [setError]);

  const closeFile = useCallback(() => {
    setCurrentFileId(null);
    setSegments([]);
    setSelectedIdx(0);
    setAudioSrc(null);
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
        setSegments(cloneSegments(fd.segments));
        try {
          setAudioSrc(fd.audio_path ? convertFileSrc(fd.audio_path) : null);
        } catch {
          setAudioSrc(null);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [current, currentFileId, setError]);

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
    closeProject,
    refreshCurrentProject,
    applyDetailBase,
  };
}
