import { useCallback, useRef, useState } from "react";
import * as fileApi from "../tauri/fileApi";
import { toast } from "../services/ui/toast";
import {
  hasImportDuplicate,
  importFileDisplayName,
  pickDuplicateOpenExistingFileId,
  type ImportDuplicateCheck,
} from "../utils/projectImportDuplicate";
import type { BusyReason } from "./useProjectCrudController";

export type DuplicateImportDecision = "cancel" | "open_existing" | "import_copy";

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
  importFileToProject: (
    kind: "audio" | "text",
    srcPath: string,
    options?: ImportFileToProjectOptions,
  ) => Promise<boolean>;
  pickAndImportFileToProject: (
    kind: "audio" | "text",
    options?: ImportFileToProjectOptions,
  ) => Promise<boolean>;
};

type Deps = {
  currentProjectId: string | null | undefined;
  busy: boolean;
  beginBusy: (reason: BusyReason) => void;
  endBusy: () => void;
  loadProjectAfterImport: (projectId: string) => Promise<void>;
  openFile: (fileId: string) => Promise<void>;
  setError: (message: string) => void;
};

export function useProjectImportDuplicateController(deps: Deps): ProjectImportDuplicateControllerApi {
  const [duplicateImportCheck, setDuplicateImportCheck] = useState<ImportDuplicateCheck | null>(
    null,
  );
  const [duplicateImportChecking, setDuplicateImportChecking] = useState(false);
  const resolverRef = useRef<((decision: DuplicateImportDecision) => void) | null>(null);
  const importGateActiveRef = useRef(false);

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

  const importFileToProject = useCallback(
    async (
      kind: "audio" | "text",
      srcPath: string,
      options?: ImportFileToProjectOptions,
    ): Promise<boolean> => {
      const projectId = deps.currentProjectId;
      if (!projectId) return false;
      if (deps.busy || importGateActiveRef.current) {
        toast.error("当前有任务进行中，请稍后再导入。");
        return false;
      }

      const name = importFileDisplayName(srcPath, kind);
      importGateActiveRef.current = true;
      setDuplicateImportChecking(true);
      try {
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
          if (kind === "audio") {
            await fileApi.importAudioToProject(projectId, name, srcPath);
          } else {
            await fileApi.importTextToProject(projectId, name, srcPath);
          }
          if (!options?.skipReload) {
            await deps.loadProjectAfterImport(projectId);
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
    [askDuplicateImport, deps],
  );

  const pickAndImportFileToProject = useCallback(
    async (kind: "audio" | "text", options?: ImportFileToProjectOptions): Promise<boolean> => {
      if (deps.busy || importGateActiveRef.current) {
        toast.error("当前有任务进行中，请稍后再导入。");
        return false;
      }
      const pick = kind === "audio" ? fileApi.pickAudioPath : fileApi.pickTextPath;
      const srcPath = await pick();
      if (!srcPath) return false;
      return importFileToProject(kind, srcPath, options);
    },
    [deps.busy, importFileToProject],
  );

  return {
    duplicateImportConfirmOpen: duplicateImportCheck !== null,
    duplicateImportChecking,
    duplicateImportCheck,
    cancelDuplicateImport,
    openExistingDuplicateImport,
    confirmDuplicateImportCopy,
    importFileToProject,
    pickAndImportFileToProject,
  };
}
