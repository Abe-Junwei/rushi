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
import {
  importAudioPathsToProject as importAudioPathsBatch,
  importDroppedPathsToProject as importDroppedPathsBatch,
  type BatchImportProgress,
} from "../services/projectBatchImport";
import { isTranscribeBusy } from "./closeGateDecision";
import { useAttachImportTargetPrompt } from "./useAttachImportTargetPrompt";
import type { BusyReason } from "./useProjectCrudController";

type DuplicateImportDecision = "cancel" | "open_existing" | "import_copy";

export type ImportFileToProjectOptions = {
  /** 批量导入时跳过单次 reload，由调用方在末尾统一 refresh */
  skipReload?: boolean;
  /** 外层已 beginBusy / 占门闩；内层不再 busy 闪烁 */
  nestInBatch?: boolean;
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
  importProgress: BatchImportProgress | null;
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
  importDroppedPathsToProject: (
    paths: string[],
  ) => Promise<{ imported: number; skipped: number; unsupported: number }>;
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
  /** 批量导入结束后只刷 Hub，不自动打开文件（避免页面跳动）。 */
  refreshProjectHub: (projectId: string) => Promise<void>;
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
  const [importProgress, setImportProgress] = useState<BatchImportProgress | null>(null);
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
    async (
      projectId: string,
      srcPath: string,
      options?: { nestInBatch?: boolean },
    ): Promise<boolean> => {
      const nest = Boolean(options?.nestInBatch);
      if (!nest) setDuplicateImportChecking(true);
      try {
        return await confirmHubTextDuplicateIfNeeded(projectId, srcPath, {
          projectFiles: deps.projectFiles,
          openFile: deps.openFile,
          checkDuplicate: fileApi.checkProjectImportDuplicate,
          askDuplicateImport,
        });
      } finally {
        if (!nest) setDuplicateImportChecking(false);
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
      const nest = Boolean(options?.nestInBatch);

      if (kind === "text" && deps.currentFileId && isTranscribeBusy(deps.busy, deps.busyReason)) {
        toast.error("转写进行中，请稍后再导入字幕。");
        return false;
      }
      if (!nest && (deps.busy || importGateActiveRef.current)) {
        toast.error("当前有任务进行中，请稍后再导入。");
        return false;
      }

      const runBusy = async (work: () => Promise<boolean>): Promise<boolean> => {
        if (nest) return work();
        deps.beginBusy("import");
        try {
          return await work();
        } finally {
          deps.endBusy();
        }
      };

      if (kind === "text" && deps.currentFileId) {
        if (!nest) importGateActiveRef.current = true;
        try {
          let imported = false;
          const proceeded = await deps.runWithUnsavedNavigateGate(async () => {
            imported = await runBusy(async () => {
              const { ok, fileId } = await runTranscriptImport(
                projectId,
                srcPath,
                deps.currentFileId,
              );
              if (!ok || !fileId) return false;
              // Editor attach: reload same file. Hub imports use refresh only (no jump).
              if (!options?.skipReload) {
                await deps.loadProjectAfterImport(projectId, fileId);
              }
              return true;
            });
          });
          return proceeded && imported;
        } catch (e) {
          deps.setError(e instanceof Error ? e.message : String(e));
          return false;
        } finally {
          if (!nest) importGateActiveRef.current = false;
        }
      }

      const name = importFileDisplayName(srcPath, kind);
      if (!nest) {
        importGateActiveRef.current = true;
        // Batch keeps the import overlay; flipping this would flash the check dialog per file.
        setDuplicateImportChecking(true);
      }
      try {
        if (kind === "audio") {
          const check = await fileApi.checkProjectImportDuplicate(projectId, srcPath);
          if (!nest) setDuplicateImportChecking(false);

          if (hasImportDuplicate(check)) {
            const decision = await askDuplicateImport(check);
            if (decision === "cancel") return false;
            if (decision === "open_existing") {
              const fileId = pickDuplicateOpenExistingFileId(check);
              if (fileId) await deps.openFile(fileId);
              return false;
            }
          }

          return runBusy(async () => {
            await fileApi.importAudioToProject(projectId, name, srcPath);
            if (!options?.skipReload) {
              await deps.refreshProjectHub(projectId);
            }
            return true;
          });
        }

        if (!nest) setDuplicateImportChecking(false);
        const duplicateOk = await runHubTextDuplicateGate(projectId, srcPath, { nestInBatch: nest });
        if (!duplicateOk) return false;
        return runBusy(async () => {
          const { ok, fileId } = await runTranscriptImport(projectId, srcPath);
          if (!ok || !fileId) return false;
          if (!options?.skipReload) {
            await deps.refreshProjectHub(projectId);
          }
          return true;
        });
      } catch (e) {
        deps.setError(e instanceof Error ? e.message : String(e));
        return false;
      } finally {
        setDuplicateImportChecking(false);
        if (!nest) importGateActiveRef.current = false;
      }
    },
    [askDuplicateImport, deps, runHubTextDuplicateGate, runTranscriptImport],
  );

  const runBatchImport = useCallback(
    async <T extends { imported: number }>(
      paths: string[],
      run: (
        onProgress: (progress: BatchImportProgress) => void,
      ) => Promise<T>,
    ): Promise<T | { imported: 0; skipped: number; unsupported?: number }> => {
      const projectId = deps.currentProjectId;
      if (!projectId || paths.length === 0) {
        return { imported: 0, skipped: paths.length };
      }
      if (deps.busy || importGateActiveRef.current) {
        toast.error("当前有任务进行中，请稍后再导入。");
        return { imported: 0, skipped: paths.length };
      }
      importGateActiveRef.current = true;
      deps.beginBusy("import");
      try {
        return await run((progress) => setImportProgress(progress));
      } finally {
        setImportProgress(null);
        deps.endBusy();
        importGateActiveRef.current = false;
      }
    },
    [deps],
  );

  const importAudioPathsToProject = useCallback(
    async (paths: string[]): Promise<{ imported: number; skipped: number }> => {
      const projectId = deps.currentProjectId;
      if (!projectId) return { imported: 0, skipped: paths.length };
      const result = await runBatchImport(paths, (onProgress) =>
        importAudioPathsBatch(
          importFileToProject,
          paths,
          async () => deps.refreshProjectHub(projectId),
          onProgress,
        ),
      );
      return { imported: result.imported, skipped: result.skipped ?? 0 };
    },
    [deps, importFileToProject, runBatchImport],
  );

  const importDroppedPathsToProject = useCallback(
    async (
      paths: string[],
    ): Promise<{ imported: number; skipped: number; unsupported: number }> => {
      const projectId = deps.currentProjectId;
      if (!projectId) return { imported: 0, skipped: paths.length, unsupported: paths.length };
      const result = await runBatchImport(paths, (onProgress) =>
        importDroppedPathsBatch(
          importFileToProject,
          paths,
          async () => deps.refreshProjectHub(projectId),
          onProgress,
        ),
      );
      return {
        imported: result.imported,
        skipped: result.skipped ?? 0,
        unsupported: "unsupported" in result ? (result.unsupported ?? 0) : 0,
      };
    },
    [deps, importFileToProject, runBatchImport],
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
    importProgress,
    importFileToProject,
    pickAndImportFileToProject,
    pickAndImportAudioPathsToProject,
    importAudioPathsToProject,
    importDroppedPathsToProject,
  };
}
