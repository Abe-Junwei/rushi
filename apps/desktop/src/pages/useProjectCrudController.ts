import { useCallback } from "react";
import type { ProjectDetail } from "../tauri/projectApi";
import * as p1 from "../tauri/projectApi";
import * as fileApi from "../tauri/fileApi";
import type { SegmentMutationApi } from "./useSegmentMutationController";

export type BusyReason =
  | "create"
  | "load"
  | "import"
  | "transcribe"
  | "save"
  | "delete"
  | "install_funasr"
  | "export"
  | "stage_b";

export interface ProjectCrudApi {
  createProject: () => Promise<void>;
  createEmptyProject: () => Promise<void>;
  createProjectFromText: () => Promise<void>;
  loadProject: (id: string) => Promise<void>;
  deleteProject: (id: string, options?: { skipBrowserConfirm?: boolean }) => Promise<void>;
}

export interface ProjectCrudDeps {
  pickedPath: string | null;
  newName: string;
  current: ProjectDetail | null;
  setError: (msg: string) => void;
  beginBusy: (reason: BusyReason) => void;
  endBusy: () => void;
  applyDetail: (d: ProjectDetail) => void;
  refreshProjects: () => Promise<void>;
  mutations: SegmentMutationApi;
  setCurrent: React.Dispatch<React.SetStateAction<ProjectDetail | null>>;
  setSegments: React.Dispatch<React.SetStateAction<import("../tauri/projectApi").SegmentDto[]>>;
  setAudioSrc: React.Dispatch<React.SetStateAction<string | null>>;
  setTranscribeHints: React.Dispatch<React.SetStateAction<string[]>>;
}

export function useProjectCrudController(deps: ProjectCrudDeps): ProjectCrudApi {
  const {
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
  } = deps;

  const createProject = useCallback(async () => {
    if (!pickedPath) {
      setError("请先选择音频文件。");
      return;
    }
    beginBusy("create");
    setError("");
    try {
      const d = await p1.projectCreate(newName.trim() || "未命名项目", pickedPath);
      applyDetail(d);
      await refreshProjects();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      endBusy();
    }
  }, [pickedPath, newName, applyDetail, refreshProjects, beginBusy, endBusy, setError]);

  const loadProject = useCallback(
    async (id: string) => {
      beginBusy("load");
      setError("");
      try {
        const d = await p1.projectLoad(id);
        applyDetail(d);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        endBusy();
      }
    },
    [applyDetail, beginBusy, endBusy, setError],
  );

  const deleteProject = useCallback(
    async (id: string, options?: { skipBrowserConfirm?: boolean }) => {
      if (!options?.skipBrowserConfirm && !window.confirm("确定删除该项目及本地音频副本？")) return;
      beginBusy("delete");
      setError("");
      try {
        await p1.projectDelete(id);
        if (current?.id === id) {
          mutations.resetMutationHistory();
          setCurrent(null);
          setSegments([]);
          setAudioSrc(null);
          setTranscribeHints([]);
        }
        await refreshProjects();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        endBusy();
      }
    },
    [current, refreshProjects, beginBusy, endBusy, mutations, setCurrent, setSegments, setAudioSrc, setTranscribeHints, setError],
  );

  const createEmptyProject = useCallback(async () => {
    beginBusy("create");
    setError("");
    try {
      const raw = await fileApi.createEmptyProject(newName.trim() || "未命名项目");
      const d = await fileApi.adaptToLegacyProjectDetail(raw);
      applyDetail(d);
      await refreshProjects();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      endBusy();
    }
  }, [newName, applyDetail, refreshProjects, beginBusy, endBusy, setError]);

  const createProjectFromText = useCallback(async () => {
    beginBusy("create");
    setError("");
    try {
      const srcPath = await fileApi.pickTextPath();
      if (!srcPath) {
        endBusy();
        return;
      }
      const raw = await fileApi.createProjectFromText(newName.trim() || "未命名项目", srcPath);
      const d = await fileApi.adaptToLegacyProjectDetail(raw);
      applyDetail(d);
      await refreshProjects();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      endBusy();
    }
  }, [newName, applyDetail, refreshProjects, beginBusy, endBusy, setError]);

  return { createProject, createEmptyProject, createProjectFromText, loadProject, deleteProject };
}
