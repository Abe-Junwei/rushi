import * as p1 from "../tauri/projectApi";
import type { ProjectDetail, ProjectSummary } from "../tauri/projectApi";
import { resolveEditorResumeTarget, type WorkspaceFileTarget } from "../services/lastWorkspace";
import { refreshRecentWorkspaceFiles } from "../services/projectFilesCacheBridge";
import type { SegmentDirtyStateApi } from "./useSegmentDirtyState";

export type CloseGateProjectLoadDeps = {
  applyDetail: (detail: ProjectDetail) => void;
  beginBusy: (reason: "load") => void;
  endBusy: () => void;
  setError: React.Dispatch<React.SetStateAction<string>>;
  setCurrent: React.Dispatch<React.SetStateAction<ProjectDetail | null>>;
  current: ProjectDetail | null;
  currentFileId: string | null;
  dirty: SegmentDirtyStateApi;
  performCloseFile: () => void;
  openFileWrapped: (fileId: string) => Promise<void>;
  /** Post-import reload — must bypass same-file dirty noop so DB replace is visible. */
  openFileAfterImport: (fileId: string) => Promise<void>;
  setOpeningWorkspaceTarget: (target: WorkspaceFileTarget | null) => void;
  projects: ProjectSummary[];
};

export function createCloseGateProjectLoadActions(deps: CloseGateProjectLoadDeps) {
  async function performLoadProject(id: string) {
    deps.setError("");
    deps.beginBusy("load");
    try {
      const detail = await p1.projectLoad(id);
      const sameProject = deps.current?.id === id;
      const fileStillExists =
        deps.currentFileId != null && detail.files?.some((f) => f.id === deps.currentFileId);

      if (sameProject && deps.dirty.hasUnsavedSegmentChanges() && deps.currentFileId && fileStillExists) {
        deps.applyDetail(detail);
        return;
      }

      if (!sameProject || deps.currentFileId) {
        deps.performCloseFile();
      }

      deps.applyDetail(detail);

      if (!detail.files?.length) {
        deps.dirty.clearSavedSnapshot();
      }
    } catch (e) {
      deps.setCurrent(null);
      deps.performCloseFile();
      deps.setError(e instanceof Error ? e.message : String(e));
    } finally {
      deps.endBusy();
    }
  }

  async function loadProjectAfterImport(id: string, preferFileId?: string | null) {
    deps.setError("");
    deps.beginBusy("load");
    try {
      const detail = await p1.projectLoad(id);
      deps.applyDetail(detail);

      if (!detail.files?.length) {
        if (deps.currentFileId) {
          deps.performCloseFile();
        } else {
          deps.dirty.clearSavedSnapshot();
        }
        return;
      }

      const preferred =
        preferFileId != null ? detail.files.find((f) => f.id === preferFileId) : undefined;
      const target = preferred ?? [...detail.files].sort((a, b) => b.updated_at_ms - a.updated_at_ms)[0];
      await deps.openFileAfterImport(target.id);
    } catch (e) {
      deps.setCurrent(null);
      deps.performCloseFile();
      deps.setError(e instanceof Error ? e.message : String(e));
    } finally {
      deps.endBusy();
    }
  }

  async function refreshProjectHub(id: string) {
    deps.setError("");
    deps.beginBusy("load");
    try {
      const detail = await p1.projectLoad(id);
      deps.applyDetail(detail);
      // Hub「所有文件」经 current.updated_at_ms 同步；此处只刷「最近」。
      refreshRecentWorkspaceFiles();
      if (!detail.files?.length) {
        deps.dirty.clearSavedSnapshot();
      }
    } catch (e) {
      deps.setCurrent(null);
      deps.performCloseFile();
      deps.setError(e instanceof Error ? e.message : String(e));
    } finally {
      deps.endBusy();
    }
  }

  async function ensureProjectLoadedForWorkspaceFile(projectId: string) {
    if (deps.current?.id === projectId) return;
    if (deps.currentFileId) {
      deps.performCloseFile();
    }
    const detail = await p1.projectLoad(projectId);
    deps.applyDetail(detail);
  }

  async function performOpenWorkspaceFile(projectId: string, fileId: string) {
    deps.setOpeningWorkspaceTarget({ projectId, fileId });
    deps.setError("");
    deps.beginBusy("load");
    try {
      await ensureProjectLoadedForWorkspaceFile(projectId);
      await deps.openFileWrapped(fileId);
    } catch (e) {
      if (deps.current?.id !== projectId) {
        deps.setCurrent(null);
        deps.performCloseFile();
      }
      deps.setError(e instanceof Error ? e.message : String(e));
    } finally {
      deps.setOpeningWorkspaceTarget(null);
      deps.endBusy();
    }
  }

  async function performResumeEditorWorkspace() {
    const target = await resolveEditorResumeTarget(deps.projects);
    if (!target) {
      deps.setError("暂无项目或文件，请先新建项目。");
      return;
    }
    await performOpenWorkspaceFile(target.projectId, target.fileId);
  }

  return {
    performLoadProject,
    loadProjectAfterImport,
    refreshProjectHub,
    performOpenWorkspaceFile,
    performResumeEditorWorkspace,
  };
}
