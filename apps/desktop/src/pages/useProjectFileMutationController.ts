import { useCallback, useState } from "react";
import { toast } from "../services/ui/toast";
import * as fileApi from "../tauri/fileApi";

export type PendingProjectFileDelete = {
  fileId: string;
  fileName: string;
  sourceProjectId: string;
} | null;

export type PendingProjectFileMove = {
  fileId: string;
  fileName: string;
  sourceProjectId: string;
  destProjectId: string;
  destProjectName: string;
} | null;

export type PendingProjectFileCopy = {
  fileId: string;
  fileName: string;
  sourceProjectId: string;
  destProjectId: string;
  destProjectName: string;
} | null;

function notifyPlacement(result: fileApi.FilePlacementResult, verb: string) {
  if (result.renamed) {
    toast.success(`${verb}完成，已重命名为「${result.finalName}」`);
  } else {
    toast.success(`${verb}完成`);
  }
}

export type ProjectFileMutationControllerApi = {
  renamingProjectFileId: string | null;
  renameProjectFileDraft: string;
  setRenameProjectFileDraft: (value: string) => void;
  beginRenameProjectFile: (fileId: string, currentName: string, sourceProjectId?: string) => void;
  cancelRenameProjectFile: () => void;
  commitRenameProjectFile: () => Promise<void>;
  pendingProjectFileDelete: PendingProjectFileDelete;
  requestDeleteProjectFile: (
    fileId: string,
    fileName: string,
    sourceProjectId?: string,
  ) => void;
  cancelDeleteProjectFile: () => void;
  confirmDeleteProjectFile: () => Promise<void>;
  pendingProjectFileMove: PendingProjectFileMove;
  requestMoveProjectFile: (args: {
    fileId: string;
    fileName: string;
    sourceProjectId: string;
    destProjectId: string;
    destProjectName: string;
  }) => void;
  /** Move without confirm dialog (drag-drop). */
  moveProjectFileNow: (args: {
    fileId: string;
    sourceProjectId: string;
    destProjectId: string;
  }) => Promise<void>;
  cancelMoveProjectFile: () => void;
  confirmMoveProjectFile: () => Promise<void>;
  pendingProjectFileCopy: PendingProjectFileCopy;
  requestCopyProjectFile: (args: {
    fileId: string;
    fileName: string;
    sourceProjectId: string;
    destProjectId: string;
    destProjectName: string;
  }) => void;
  cancelCopyProjectFile: () => void;
  confirmCopyProjectFile: () => Promise<void>;
  revealProjectLocation: (projectId: string) => Promise<void>;
  revealFileLocation: (fileId: string) => Promise<void>;
};

type Deps = {
  projectId: string | null | undefined;
  busy: boolean;
  refreshProjectHub: (projectId: string) => Promise<void>;
  refreshProjects: () => Promise<void>;
  closeOpenFileIfNeeded: (fileId: string) => Promise<void>;
  invalidateProjectFilesCaches?: (projectIds: string[]) => void;
  setError: (message: string) => void;
};

export function useProjectFileMutationController(deps: Deps): ProjectFileMutationControllerApi {
  const [renamingProjectFileId, setRenamingProjectFileId] = useState<string | null>(null);
  const [renamingProjectFileSourceId, setRenamingProjectFileSourceId] = useState<string | null>(
    null,
  );
  const [renameProjectFileDraft, setRenameProjectFileDraft] = useState("");
  const [pendingProjectFileDelete, setPendingProjectFileDelete] =
    useState<PendingProjectFileDelete>(null);
  const [pendingProjectFileMove, setPendingProjectFileMove] =
    useState<PendingProjectFileMove>(null);
  const [pendingProjectFileCopy, setPendingProjectFileCopy] =
    useState<PendingProjectFileCopy>(null);

  const refreshAfterPlacement = useCallback(
    async (sourceProjectId: string, destProjectId: string) => {
      await deps.refreshProjects();
      const openId = deps.projectId;
      if (openId === sourceProjectId || openId === destProjectId) {
        await deps.refreshProjectHub(openId);
      }
      deps.invalidateProjectFilesCaches?.([sourceProjectId, destProjectId]);
    },
    [deps],
  );

  const beginRenameProjectFile = useCallback(
    (fileId: string, currentName: string, sourceProjectId?: string) => {
      setRenamingProjectFileId(fileId);
      setRenamingProjectFileSourceId(sourceProjectId ?? deps.projectId ?? null);
      setRenameProjectFileDraft(currentName);
    },
    [deps.projectId],
  );

  const cancelRenameProjectFile = useCallback(() => {
    setRenamingProjectFileId(null);
    setRenamingProjectFileSourceId(null);
    setRenameProjectFileDraft("");
  }, []);

  const commitRenameProjectFile = useCallback(async () => {
    const projectId = renamingProjectFileSourceId ?? deps.projectId;
    const fileId = renamingProjectFileId;
    const name = renameProjectFileDraft.trim();
    if (!fileId || !name || deps.busy) return;

    try {
      await fileApi.renameFile(fileId, name);
      cancelRenameProjectFile();
      if (projectId) {
        if (deps.projectId === projectId) await deps.refreshProjectHub(projectId);
        deps.invalidateProjectFilesCaches?.([projectId]);
      }
      await deps.refreshProjects();
    } catch (e) {
      deps.setError(e instanceof Error ? e.message : String(e));
    }
  }, [
    cancelRenameProjectFile,
    deps,
    renameProjectFileDraft,
    renamingProjectFileId,
    renamingProjectFileSourceId,
  ]);

  const requestDeleteProjectFile = useCallback(
    (fileId: string, fileName: string, sourceProjectId?: string) => {
      if (deps.busy) return;
      const source = sourceProjectId ?? deps.projectId;
      if (!source) return;
      setPendingProjectFileDelete({ fileId, fileName, sourceProjectId: source });
    },
    [deps.busy, deps.projectId],
  );

  const cancelDeleteProjectFile = useCallback(() => {
    setPendingProjectFileDelete(null);
  }, []);

  const confirmDeleteProjectFile = useCallback(async () => {
    const pending = pendingProjectFileDelete;
    if (!pending || deps.busy) return;

    try {
      await deps.closeOpenFileIfNeeded(pending.fileId);
      await fileApi.deleteFile(pending.fileId);
      setPendingProjectFileDelete(null);
      await deps.refreshProjects();
      if (deps.projectId === pending.sourceProjectId) {
        await deps.refreshProjectHub(pending.sourceProjectId);
      }
      deps.invalidateProjectFilesCaches?.([pending.sourceProjectId]);
    } catch (e) {
      deps.setError(e instanceof Error ? e.message : String(e));
    }
  }, [deps, pendingProjectFileDelete]);

  const requestMoveProjectFile = useCallback(
    (args: {
      fileId: string;
      fileName: string;
      sourceProjectId: string;
      destProjectId: string;
      destProjectName: string;
    }) => {
      if (deps.busy) return;
      if (args.sourceProjectId === args.destProjectId) return;
      setPendingProjectFileMove(args);
    },
    [deps.busy],
  );

  const cancelMoveProjectFile = useCallback(() => {
    setPendingProjectFileMove(null);
  }, []);

  const runMove = useCallback(
    async (fileId: string, sourceProjectId: string, destProjectId: string) => {
      await deps.closeOpenFileIfNeeded(fileId);
      const result = await fileApi.moveFileToProject(fileId, destProjectId);
      notifyPlacement(result, "移动");
      await refreshAfterPlacement(sourceProjectId, destProjectId);
    },
    [deps, refreshAfterPlacement],
  );

  const confirmMoveProjectFile = useCallback(async () => {
    const pending = pendingProjectFileMove;
    if (!pending || deps.busy) return;
    try {
      await runMove(pending.fileId, pending.sourceProjectId, pending.destProjectId);
      setPendingProjectFileMove(null);
    } catch (e) {
      setPendingProjectFileMove(null);
      deps.setError(e instanceof Error ? e.message : String(e));
    }
  }, [deps, pendingProjectFileMove, runMove]);

  const moveProjectFileNow = useCallback(
    async (args: { fileId: string; sourceProjectId: string; destProjectId: string }) => {
      if (deps.busy) return;
      if (args.sourceProjectId === args.destProjectId) return;
      try {
        await runMove(args.fileId, args.sourceProjectId, args.destProjectId);
      } catch (e) {
        deps.setError(e instanceof Error ? e.message : String(e));
      }
    },
    [deps, runMove],
  );

  const requestCopyProjectFile = useCallback(
    (args: {
      fileId: string;
      fileName: string;
      sourceProjectId: string;
      destProjectId: string;
      destProjectName: string;
    }) => {
      if (deps.busy) return;
      setPendingProjectFileCopy(args);
    },
    [deps.busy],
  );

  const cancelCopyProjectFile = useCallback(() => {
    setPendingProjectFileCopy(null);
  }, []);

  const confirmCopyProjectFile = useCallback(async () => {
    const pending = pendingProjectFileCopy;
    if (!pending || deps.busy) return;
    try {
      const result = await fileApi.copyFileToProject(pending.fileId, pending.destProjectId);
      notifyPlacement(result, "复制");
      setPendingProjectFileCopy(null);
      await refreshAfterPlacement(pending.sourceProjectId, pending.destProjectId);
    } catch (e) {
      setPendingProjectFileCopy(null);
      deps.setError(e instanceof Error ? e.message : String(e));
    }
  }, [deps, pendingProjectFileCopy, refreshAfterPlacement]);

  const revealProjectLocation = useCallback(
    async (projectId: string) => {
      try {
        await fileApi.revealProjectInFileManager(projectId);
      } catch (e) {
        deps.setError(e instanceof Error ? e.message : String(e));
      }
    },
    [deps],
  );

  const revealFileLocation = useCallback(
    async (fileId: string) => {
      try {
        await fileApi.revealFileInFileManager(fileId);
      } catch (e) {
        deps.setError(e instanceof Error ? e.message : String(e));
      }
    },
    [deps],
  );

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
    pendingProjectFileMove,
    requestMoveProjectFile,
    moveProjectFileNow,
    cancelMoveProjectFile,
    confirmMoveProjectFile,
    pendingProjectFileCopy,
    requestCopyProjectFile,
    cancelCopyProjectFile,
    confirmCopyProjectFile,
    revealProjectLocation,
    revealFileLocation,
  };
}
