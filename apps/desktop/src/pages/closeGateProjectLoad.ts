import * as p1 from "../tauri/projectApi";
import type { ProjectDetail, ProjectSummary } from "../tauri/projectApi";
import { resolveEditorResumeTarget } from "../services/lastWorkspace";
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

  async function performResumeEditorWorkspace() {
    const target = await resolveEditorResumeTarget(deps.projects);
    if (!target) {
      deps.setError("暂无项目或文件，请先新建项目。");
      return;
    }
    deps.beginBusy("load");
    deps.setError("");
    try {
      if (deps.current?.id !== target.projectId) {
        const detail = await p1.projectLoad(target.projectId);
        deps.applyDetail(detail);
      }
      await deps.openFileWrapped(target.fileId);
    } catch (e) {
      deps.setError(e instanceof Error ? e.message : String(e));
    } finally {
      deps.endBusy();
    }
  }

  return {
    performLoadProject,
    loadProjectAfterImport,
    refreshProjectHub,
    performResumeEditorWorkspace,
  };
}
