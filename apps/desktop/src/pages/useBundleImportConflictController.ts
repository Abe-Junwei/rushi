import { useCallback, useState } from "react";
import {
  draftsFromPreview,
  resolutionsFromDrafts,
  type BundleConflictDraft,
} from "../components/BundleImportNameConflictDialog";
import type { ExchangeBundleImportPreview, ProjectDetail } from "../tauri/projectApi";
import * as p1 from "../tauri/projectApi";
import { toast } from "../services/ui/toast";
import type { BusyReason } from "./useProjectCrudController";

export interface BundleImportConflictApi {
  importProjectBundle: () => Promise<void>;
  bundleImportConflictPending: ExchangeBundleImportPreview | null;
  bundleImportConflictDrafts: Record<string, BundleConflictDraft>;
  setBundleImportConflictDraft: (id: string, draft: BundleConflictDraft) => void;
  applyAllBundleImportOverwrite: () => void;
  applyAllBundleImportRename: () => void;
  cancelBundleImportConflict: () => void;
  confirmBundleImportConflict: () => Promise<void>;
}

export interface BundleImportConflictDeps {
  setError: (msg: string) => void;
  beginBusy: (reason: BusyReason) => void;
  endBusy: () => void;
  refreshProjects: () => Promise<void>;
  applyDetail: (d: ProjectDetail) => void;
}

/** Content-package import: pick → preview name conflicts → resolve (overwrite/rename) → apply. */
export function useBundleImportConflictController(
  deps: BundleImportConflictDeps,
): BundleImportConflictApi {
  const { setError, beginBusy, endBusy, refreshProjects, applyDetail } = deps;

  const [bundleImportConflictPending, setBundleImportConflictPending] =
    useState<ExchangeBundleImportPreview | null>(null);
  const [bundleImportConflictDrafts, setBundleImportConflictDrafts] = useState<
    Record<string, BundleConflictDraft>
  >({});

  const finishBundleImportResult = useCallback(
    async (result: p1.ImportExchangeBundleResult) => {
      applyDetail(result.project);
      await refreshProjects();
      if (result.failedCount > 0) {
        const sample = result.failedLabels.slice(0, 3).join("；");
        toast.info(
          `已导入 ${result.importedCount} 个项目，${result.failedCount} 个失败${sample ? `：${sample}` : ""}`,
        );
      } else {
        toast.success(
          result.importedCount > 1
            ? `已导入整库包（${result.importedCount} 个项目）`
            : "已导入内容包",
        );
      }
      if (result.lexiconWarning) {
        toast.info(result.lexiconWarning);
      }
    },
    [applyDetail, refreshProjects],
  );

  const importProjectBundle = useCallback(async () => {
    setError("");
    beginBusy("import");
    try {
      const preview = await p1.importExchangeBundlePreview();
      if (!preview) return;
      if (preview.conflicts.length === 0) {
        const result = await p1.importExchangeBundleApply(preview.zipPath, []);
        await finishBundleImportResult(result);
        return;
      }
      setBundleImportConflictDrafts(draftsFromPreview(preview));
      setBundleImportConflictPending(preview);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      endBusy();
    }
  }, [beginBusy, endBusy, finishBundleImportResult, setError]);

  const setBundleImportConflictDraft = useCallback((id: string, draft: BundleConflictDraft) => {
    setBundleImportConflictDrafts((prev) => ({ ...prev, [id]: draft }));
  }, []);

  const applyAllBundleImportOverwrite = useCallback(() => {
    setBundleImportConflictDrafts((prev) => {
      const pending = bundleImportConflictPending;
      if (!pending) return prev;
      const next = { ...prev };
      for (const c of pending.conflicts) {
        if (!c.existingFileId) continue;
        next[c.id] = {
          action: "overwrite",
          renameTo: prev[c.id]?.renameTo ?? c.suggestedName,
        };
      }
      return next;
    });
  }, [bundleImportConflictPending]);

  const applyAllBundleImportRename = useCallback(() => {
    const pending = bundleImportConflictPending;
    if (!pending) return;
    const next: Record<string, BundleConflictDraft> = {};
    for (const c of pending.conflicts) {
      next[c.id] = { action: "rename", renameTo: c.suggestedName };
    }
    setBundleImportConflictDrafts(next);
  }, [bundleImportConflictPending]);

  const cancelBundleImportConflict = useCallback(() => {
    setBundleImportConflictPending(null);
    setBundleImportConflictDrafts({});
  }, []);

  const confirmBundleImportConflict = useCallback(async () => {
    const pending = bundleImportConflictPending;
    if (!pending) return;
    const resolutions = resolutionsFromDrafts(pending, bundleImportConflictDrafts);
    setError("");
    beginBusy("import");
    try {
      const result = await p1.importExchangeBundleApply(pending.zipPath, resolutions);
      setBundleImportConflictPending(null);
      setBundleImportConflictDrafts({});
      await finishBundleImportResult(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      endBusy();
    }
  }, [
    beginBusy,
    bundleImportConflictDrafts,
    bundleImportConflictPending,
    endBusy,
    finishBundleImportResult,
    setError,
  ]);

  return {
    importProjectBundle,
    bundleImportConflictPending,
    bundleImportConflictDrafts,
    setBundleImportConflictDraft,
    applyAllBundleImportOverwrite,
    applyAllBundleImportRename,
    cancelBundleImportConflict,
    confirmBundleImportConflict,
  };
}
