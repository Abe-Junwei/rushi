import { useCallback, useState } from "react";
import * as fileApi from "../tauri/fileApi";

export type PendingProjectFileDelete = {
  fileId: string;
  fileName: string;
} | null;

export type ProjectFileMutationControllerApi = {
  renamingProjectFileId: string | null;
  renameProjectFileDraft: string;
  setRenameProjectFileDraft: (value: string) => void;
  beginRenameProjectFile: (fileId: string, currentName: string) => void;
  cancelRenameProjectFile: () => void;
  commitRenameProjectFile: () => Promise<void>;
  pendingProjectFileDelete: PendingProjectFileDelete;
  requestDeleteProjectFile: (fileId: string, fileName: string) => void;
  cancelDeleteProjectFile: () => void;
  confirmDeleteProjectFile: () => Promise<void>;
};

type Deps = {
  projectId: string | null | undefined;
  busy: boolean;
  refreshProjectHub: (projectId: string) => Promise<void>;
  setError: (message: string) => void;
};

export function useProjectFileMutationController(deps: Deps): ProjectFileMutationControllerApi {
  const [renamingProjectFileId, setRenamingProjectFileId] = useState<string | null>(null);
  const [renameProjectFileDraft, setRenameProjectFileDraft] = useState("");
  const [pendingProjectFileDelete, setPendingProjectFileDelete] =
    useState<PendingProjectFileDelete>(null);

  const beginRenameProjectFile = useCallback((fileId: string, currentName: string) => {
    setRenamingProjectFileId(fileId);
    setRenameProjectFileDraft(currentName);
  }, []);

  const cancelRenameProjectFile = useCallback(() => {
    setRenamingProjectFileId(null);
    setRenameProjectFileDraft("");
  }, []);

  const commitRenameProjectFile = useCallback(async () => {
    const projectId = deps.projectId;
    const fileId = renamingProjectFileId;
    const name = renameProjectFileDraft.trim();
    if (!projectId || !fileId || !name || deps.busy) return;

    try {
      await fileApi.renameFile(fileId, name);
      cancelRenameProjectFile();
      await deps.refreshProjectHub(projectId);
    } catch (e) {
      deps.setError(e instanceof Error ? e.message : String(e));
    }
  }, [
    cancelRenameProjectFile,
    deps,
    renameProjectFileDraft,
    renamingProjectFileId,
  ]);

  const requestDeleteProjectFile = useCallback((fileId: string, fileName: string) => {
    if (deps.busy) return;
    setPendingProjectFileDelete({ fileId, fileName });
  }, [deps.busy]);

  const cancelDeleteProjectFile = useCallback(() => {
    setPendingProjectFileDelete(null);
  }, []);

  const confirmDeleteProjectFile = useCallback(async () => {
    const projectId = deps.projectId;
    const pending = pendingProjectFileDelete;
    if (!projectId || !pending || deps.busy) return;

    try {
      await fileApi.deleteFile(pending.fileId);
      setPendingProjectFileDelete(null);
      await deps.refreshProjectHub(projectId);
    } catch (e) {
      deps.setError(e instanceof Error ? e.message : String(e));
    }
  }, [deps, pendingProjectFileDelete]);

  return {
    renamingProjectFileId,
    renameProjectFileDraft,
    setRenameProjectFileDraft,
    beginRenameProjectFile,
    cancelRenameProjectFile,
    commitRenameProjectFile,
    pendingProjectFileDelete,
    requestDeleteProjectFile,
    cancelDeleteProjectFile,
    confirmDeleteProjectFile,
  };
}
