import { useCallback, useState } from "react";
import type { ProjectDetail, ProjectMetadata } from "../tauri/projectApi";
import * as p1 from "../tauri/projectApi";
import { mergeProjectDetailMetadata } from "../utils/projectDuplicateName";
import { normalizeRecordedAtForSave } from "../utils/projectRecordedAt";

export type ProjectMetadataForm = ProjectMetadata & {
  name: string;
};

export type PendingProjectDelete = {
  projectId: string;
  projectName: string;
} | null;

export type ProjectMutationControllerApi = {
  isRenamingProject: boolean;
  renamingProjectId: string | null;
  renameProjectDraft: string;
  setRenameProjectDraft: (value: string) => void;
  beginRenameProject: (currentName: string, projectId?: string) => void;
  cancelRenameProject: () => void;
  commitRenameProject: () => Promise<void>;
  projectMetadataDialogOpen: boolean;
  projectMetadataAfterCreate: boolean;
  openProjectMetadataDialog: (options?: { afterCreate?: boolean }) => void;
  closeProjectMetadataDialog: () => void;
  saveProjectMetadata: (form: ProjectMetadataForm) => Promise<void>;
  pendingProjectDelete: PendingProjectDelete;
  requestDeleteProject: (projectId: string, projectName: string) => void;
  cancelDeleteProject: () => void;
  confirmDeleteProject: () => Promise<void>;
};

type Deps = {
  current: ProjectDetail | null | undefined;
  busy: boolean;
  refreshProjectHub: (projectId: string) => Promise<void>;
  refreshProjects: () => Promise<void>;
  deleteProject: (id: string, options?: { skipBrowserConfirm?: boolean }) => Promise<void>;
  setError: (message: string) => void;
  setCurrent: React.Dispatch<React.SetStateAction<ProjectDetail | null>>;
};

export function useProjectMutationController(deps: Deps): ProjectMutationControllerApi {
  const { busy, current } = deps;
  const [isRenamingProject, setIsRenamingProject] = useState(false);
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null);
  const [renameProjectDraft, setRenameProjectDraft] = useState("");
  const [projectMetadataDialogOpen, setProjectMetadataDialogOpen] = useState(false);
  const [projectMetadataAfterCreate, setProjectMetadataAfterCreate] = useState(false);
  const [pendingProjectDelete, setPendingProjectDelete] =
    useState<PendingProjectDelete>(null);

  const beginRenameProject = useCallback((currentName: string, projectId?: string) => {
    setIsRenamingProject(true);
    setRenamingProjectId(projectId ?? deps.current?.id ?? null);
    setRenameProjectDraft(currentName);
  }, [deps.current?.id]);

  const cancelRenameProject = useCallback(() => {
    setIsRenamingProject(false);
    setRenamingProjectId(null);
    setRenameProjectDraft("");
  }, []);

  const commitRenameProject = useCallback(async () => {
    const projectId = renamingProjectId ?? deps.current?.id;
    const name = renameProjectDraft.trim();
    if (!projectId || !name || deps.busy) return;

    try {
      const detail = await p1.renameProject(projectId, name);
      cancelRenameProject();
      if (deps.current?.id === projectId) {
        deps.setCurrent((prev) => (prev ? mergeProjectDetailMetadata(prev, detail) : detail));
        await deps.refreshProjectHub(projectId);
      }
      await deps.refreshProjects();
    } catch (e) {
      deps.setError(e instanceof Error ? e.message : String(e));
    }
  }, [cancelRenameProject, deps, renameProjectDraft, renamingProjectId]);

  const openProjectMetadataDialog = useCallback((options?: { afterCreate?: boolean }) => {
    if (busy) return;
    // afterCreate: applyDetail setState may not have flushed yet; dialog opens on same batched render.
    if (!current && !options?.afterCreate) return;
    setProjectMetadataAfterCreate(options?.afterCreate ?? false);
    setProjectMetadataDialogOpen(true);
  }, [busy, current]);

  const closeProjectMetadataDialog = useCallback(() => {
    setProjectMetadataDialogOpen(false);
    setProjectMetadataAfterCreate(false);
  }, []);

  const saveProjectMetadata = useCallback(
    async (form: ProjectMetadataForm) => {
      const projectId = deps.current?.id;
      if (!projectId || deps.busy) return;

      const trimmedName = form.name.trim() || "未命名项目";

      try {
        let detail = deps.current;
        if (trimmedName !== deps.current?.name) {
          detail = await p1.renameProject(projectId, trimmedName);
        }
        const metaDetail = await p1.updateProjectMetadata(projectId, {
          narrator: form.narrator,
          recorded_at: normalizeRecordedAtForSave(form.recorded_at),
          location: form.location,
          subject: form.subject,
          transcriber: form.transcriber,
        });
        const merged = {
          ...(detail ?? metaDetail),
          ...metaDetail,
          name: metaDetail.name,
        };
        deps.setCurrent((prev) => (prev ? mergeProjectDetailMetadata(prev, merged) : merged));
        await deps.refreshProjects();
        await deps.refreshProjectHub(projectId);
        closeProjectMetadataDialog();
      } catch (e) {
        deps.setError(e instanceof Error ? e.message : String(e));
      }
    },
    [closeProjectMetadataDialog, deps],
  );

  const requestDeleteProject = useCallback(
    (projectId: string, projectName: string) => {
      if (deps.busy) return;
      setPendingProjectDelete({ projectId, projectName });
    },
    [deps.busy],
  );

  const cancelDeleteProject = useCallback(() => {
    setPendingProjectDelete(null);
  }, []);

  const confirmDeleteProject = useCallback(async () => {
    const pending = pendingProjectDelete;
    if (!pending || deps.busy) return;

    try {
      setPendingProjectDelete(null);
      await deps.deleteProject(pending.projectId, { skipBrowserConfirm: true });
    } catch (e) {
      deps.setError(e instanceof Error ? e.message : String(e));
    }
  }, [deps, pendingProjectDelete]);

  return {
    isRenamingProject,
    renamingProjectId,
    renameProjectDraft,
    setRenameProjectDraft,
    beginRenameProject,
    cancelRenameProject,
    commitRenameProject,
    projectMetadataDialogOpen,
    projectMetadataAfterCreate,
    openProjectMetadataDialog,
    closeProjectMetadataDialog,
    saveProjectMetadata,
    pendingProjectDelete,
    requestDeleteProject,
    cancelDeleteProject,
    confirmDeleteProject,
  };
}
