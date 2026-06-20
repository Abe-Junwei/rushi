import { useCallback, useRef, useState } from "react";
import * as fileApi from "../tauri/fileApi";
import { toast } from "../services/ui/toast";
import {
  hasImportDuplicate,
  importFileDisplayName,
  pickDuplicateOpenExistingFileId,
  type ImportDuplicateCheck,
} from "../utils/projectImportDuplicate";
import {
  confirmHubTextDuplicateIfNeeded,
  resolveTranscriptImport,
} from "../services/projectAttachTranscriptImport";
import { importAudioPathsToProject as importAudioPathsBatch } from "../services/projectBatchImport";
import { isTranscribeBusy } from "./closeGateDecision";
import { useAttachImportTargetPrompt } from "./useAttachImportTargetPrompt";
import type { BusyReason } from "./useProjectCrudController";

type DuplicateImportDecision = "cancel" | "open_existing" | "import_copy";

export type ImportFileToProjectOptions = {
  /** 批量导入时跳过单次 reload，由调用方在末尾统一 loadProjectAfterImport */
  skipReload?: boolean;
};

export type ProjectImportDuplicateControllerApi = {
  duplicateImportConfirmOpen: boolean;
  duplicateImportChecking: boolean;
  duplicateImportCheck: ImportDuplicateCheck | null;
  cancelDuplicateImport: () => void;
  openExistingDuplicateImport: () => void;
  confirmDuplicateImportCopy: () => void;
  attachImportTargetOpen: boolean;
  attachImportTargetCandidates: import("../tauri/projectTypes").FileSummary[];
  attachImportTargetStem: string | null;
  cancelAttachImportTarget: () => void;
  confirmAttachImportTarget: (fileId: string) => void;
  importFileToProject: (
    kind: "audio" | "text",
    srcPath: string,
    options?: ImportFileToProjectOptions,
  ) => Promise<boolean>;
  pickAndImportFileToProject: (
    kind: "audio" | "text",
    options?: ImportFileToProjectOptions,
  ) => Promise<boolean>;
  pickAndImportAudioPathsToProject: () => Promise<{ imported: number; skipped: number }>;
  importAudioPathsToProject: (
    paths: string[],
  ) => Promise<{ imported: number; skipped: number }>;
};

type Deps = {
  currentProjectId: string | null | undefined;
  currentFileId: string | null;
  projectFiles: readonly { name: string; file_type: string }[] | undefined;
  busy: boolean;
  busyReason: BusyReason | null;
  beginBusy: (reason: BusyReason) => void;
  endBusy: () => void;
  loadProjectAfterImport: (projectId: string, preferFileId?: string | null) => Promise<void>;
  openFile: (fileId: string) => Promise<void>;
  runWithUnsavedNavigateGate: (
    onProceed: () => void | Promise<void>,
  ) => Promise<boolean>;
  setError: (message: string) => void;
};

export function useProjectImportDuplicateController(deps: Deps): ProjectImportDuplicateControllerApi {
  const [duplicateImportCheck, setDuplicateImportCheck] = useState<ImportDuplicateCheck | null>(
    null,
  );
  const [duplicateImportChecking, setDuplicateImportChecking] = useState(false);
  const resolverRef = useRef<((decision: DuplicateImportDecision) => void) | null>(null);
  const importGateActiveRef = useRef(false);
  const attachTarget = useAttachImportTargetPrompt();

  const finishPrompt = useCallback((decision: DuplicateImportDecision) => {
    resolverRef.current?.(decision);
    resolverRef.current = null;
    setDuplicateImportCheck(null);
  }, []);

  const cancelDuplicateImport = useCallback(() => {
    finishPrompt("cancel");
  }, [finishPrompt]);

  const openExistingDuplicateImport = useCallback(() => {
    finishPrompt("open_existing");
  }, [finishPrompt]);

  const confirmDuplicateImportCopy = useCallback(() => {
    finishPrompt("import_copy");
  }, [finishPrompt]);

  const askDuplicateImport = useCallback((check: ImportDuplicateCheck): Promise<DuplicateImportDecision> => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setDuplicateImportCheck(check);
    });
  }, []);

  const runTranscriptImport = useCallback(
    (projectId: string, srcPath: string, targetFileId?: string | null) =>
      resolveTranscriptImport(
        projectId,
        srcPath,
        attachTarget.askAttachImportTarget,
        targetFileId,
      ),
    [attachTarget.askAttachImportTarget],
  );

  const runHubTextDuplicateGate = useCallback(
    async (projectId: string, srcPath: string): Promise<boolean> => {
      setDuplicateImportChecking(true);
      try {
        return await confirmHubTextDuplicateIfNeeded(projectId, srcPath, {
          projectFiles: deps.projectFiles,
          openFile: deps.openFile,
          checkDuplicate: fileApi.checkProjectImportDuplicate,
          askDuplicateImport,
        });
      } finally {
        setDuplicateImportChecking(false);
      }
    },
    [askDuplicateImport, deps.openFile, deps.projectFiles],
  );

  const importFileToProject = useCallback(
    async (
      kind: "audio" | "text",
      srcPath: string,
      options?: ImportFileToProjectOptions,
    ): Promise<boolean> => {
      const projectId = deps.currentProjectId;
      if (!projectId) return false;

      if (kind === "text" && deps.currentFileId && isTranscribeBusy(deps.busy, deps.busyReason)) {
        toast.error("转写进行中，请稍后再导入字幕。");
        return false;
      }
      if (deps.busy || importGateActiveRef.current) {
        toast.error("当前有任务进行中，请稍后再导入。");
        return false;
      }

      if (kind === "text" && deps.currentFileId) {
        importGateActiveRef.current = true;
        try {
          let imported = false;
          const proceeded = await deps.runWithUnsavedNavigateGate(async () => {
            deps.beginBusy("import");
            try {
              const { ok, fileId } = await runTranscriptImport(
                projectId,
                srcPath,
                deps.currentFileId,
              );
              if (!ok || !fileId) return;
              if (!options?.skipReload) {
                await deps.loadProjectAfterImport(projectId, fileId);
              }
              imported = true;
            } finally {
              deps.endBusy();
            }
          });
          return proceeded && imported;
        } catch (e) {
          deps.setError(e instanceof Error ? e.message : String(e));
          return false;
        } finally {
          importGateActiveRef.current = false;
        }
      }

      const name = importFileDisplayName(srcPath, kind);
      importGateActiveRef.current = true;
      setDuplicateImportChecking(true);
      try {
        if (kind === "audio") {
          const check = await fileApi.checkProjectImportDuplicate(projectId, srcPath);
          setDuplicateImportChecking(false);

          if (hasImportDuplicate(check)) {
            const decision = await askDuplicateImport(check);
            if (decision === "cancel") return false;
            if (decision === "open_existing") {
              const fileId = pickDuplicateOpenExistingFileId(check);
              if (fileId) await deps.openFile(fileId);
              return false;
            }
          }

          deps.beginBusy("import");
          try {
            await fileApi.importAudioToProject(projectId, name, srcPath);
            if (!options?.skipReload) {
              await deps.loadProjectAfterImport(projectId);
            }
            return true;
          } finally {
            deps.endBusy();
          }
        }

        setDuplicateImportChecking(false);
        const duplicateOk = await runHubTextDuplicateGate(projectId, srcPath);
        if (!duplicateOk) return false;
        deps.beginBusy("import");
        try {
          const { ok, fileId } = await runTranscriptImport(projectId, srcPath);
          if (!ok || !fileId) return false;
          if (!options?.skipReload) {
            await deps.loadProjectAfterImport(projectId, fileId);
          }
          return true;
        } finally {
          deps.endBusy();
        }
      } catch (e) {
        deps.setError(e instanceof Error ? e.message : String(e));
        return false;
      } finally {
        setDuplicateImportChecking(false);
        importGateActiveRef.current = false;
      }
    },
    [askDuplicateImport, deps, runHubTextDuplicateGate, runTranscriptImport],
  );

  const importAudioPathsToProject = useCallback(
    async (paths: string[]): Promise<{ imported: number; skipped: number }> => {
      const projectId = deps.currentProjectId;
      if (!projectId || paths.length === 0) return { imported: 0, skipped: paths.length };
      if (deps.busy || importGateActiveRef.current) {
        toast.error("当前有任务进行中，请稍后再导入。");
        return { imported: 0, skipped: paths.length };
      }
      return importAudioPathsBatch(
        importFileToProject,
        paths,
        async () => deps.loadProjectAfterImport(projectId),
      );
    },
    [deps, importFileToProject],
  );

  const pickAndImportAudioPathsToProject = useCallback(async (): Promise<{
    imported: number;
    skipped: number;
  }> => {
    if (deps.busy || importGateActiveRef.current) {
      toast.error("当前有任务进行中，请稍后再导入。");
      return { imported: 0, skipped: 0 };
    }
    const paths = await fileApi.pickAudioPaths();
    if (paths.length === 0) return { imported: 0, skipped: 0 };
    return importAudioPathsToProject(paths);
  }, [deps.busy, importAudioPathsToProject]);

  const pickAndImportFileToProject = useCallback(
    async (kind: "audio" | "text", options?: ImportFileToProjectOptions): Promise<boolean> => {
      if (kind === "audio") {
        const result = await pickAndImportAudioPathsToProject();
        return result.imported > 0;
      }
      if (deps.busy || importGateActiveRef.current) {
        toast.error("当前有任务进行中，请稍后再导入。");
        return false;
      }
      const srcPath = await fileApi.pickTextPath();
      if (!srcPath) return false;
      return importFileToProject(kind, srcPath, options);
    },
    [deps.busy, importFileToProject, pickAndImportAudioPathsToProject],
  );

  return {
    duplicateImportConfirmOpen: duplicateImportCheck !== null,
    duplicateImportChecking,
    duplicateImportCheck,
    cancelDuplicateImport,
    openExistingDuplicateImport,
    confirmDuplicateImportCopy,
    attachImportTargetOpen: attachTarget.attachImportTargetOpen,
    attachImportTargetCandidates: attachTarget.attachImportTargetCandidates,
    attachImportTargetStem: attachTarget.attachImportTargetStem,
    cancelAttachImportTarget: attachTarget.cancelAttachImportTarget,
    confirmAttachImportTarget: attachTarget.confirmAttachImportTarget,
    importFileToProject,
    pickAndImportFileToProject,
    pickAndImportAudioPathsToProject,
    importAudioPathsToProject,
  };
}
