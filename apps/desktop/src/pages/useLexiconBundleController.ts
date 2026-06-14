import { useCallback, useState } from "react";
import { isTauriRuntime } from "../config/env";
import type {
  LexiconBundleConflictResolution,
  LexiconBundleExportPreview,
  LexiconBundleImportPreviewResult,
} from "../tauri/lexiconBundleApi";
import * as bundle from "../tauri/lexiconBundleApi";

type Args = {
  onImported: () => void | Promise<void>;
  setError: (msg: string) => void;
  setStatusMessage: (msg: string) => void;
  setBusy: (busy: boolean) => void;
};

export function useLexiconBundleController(args: Args) {
  const { onImported, setError, setStatusMessage, setBusy } = args;
  const [exportStableOnly, setExportStableOnly] = useState(true);
  const [exportLabel, setExportLabel] = useState("");
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportPreview, setExportPreview] = useState<LexiconBundleExportPreview | null>(null);
  const [exportPreviewLoading, setExportPreviewLoading] = useState(false);
  const [pendingImport, setPendingImport] = useState<LexiconBundleImportPreviewResult | null>(
    null,
  );
  const [resolutions, setResolutions] = useState<Record<string, LexiconBundleConflictResolution["choice"]>>(
    {},
  );

  const loadExportPreview = useCallback(async (stableOnly: boolean) => {
    return bundle.lexiconBundleExportPreview(stableOnly);
  }, []);

  const openExportDialog = useCallback(async () => {
    if (!isTauriRuntime()) {
      setError("浏览器预览无法导出词表包，请在桌面应用中操作。");
      return;
    }
    setExportDialogOpen(true);
    setExportPreviewLoading(true);
    setError("");
    setStatusMessage("");
    try {
      const preview = await loadExportPreview(exportStableOnly);
      setExportPreview(preview);
    } catch (e) {
      setExportDialogOpen(false);
      setExportPreview(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setExportPreviewLoading(false);
    }
  }, [exportStableOnly, loadExportPreview, setError, setStatusMessage]);

  const handleExportStableOnlyChange = useCallback(
    async (checked: boolean) => {
      setExportStableOnly(checked);
      if (!exportDialogOpen) return;
      setExportPreviewLoading(true);
      try {
        const preview = await loadExportPreview(checked);
        setExportPreview(preview);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setExportPreviewLoading(false);
      }
    },
    [exportDialogOpen, loadExportPreview, setError],
  );

  const cancelExport = useCallback(() => {
    setExportDialogOpen(false);
    setExportPreview(null);
    setExportPreviewLoading(false);
  }, []);

  const confirmExport = useCallback(async () => {
    if (!isTauriRuntime()) {
      setError("浏览器预览无法导出词表包，请在桌面应用中操作。");
      return;
    }
    setBusy(true);
    setError("");
    setStatusMessage("");
    try {
      const path = await bundle.lexiconBundleExport(exportStableOnly, exportLabel);
      if (path) {
        setStatusMessage(`已导出词表包至 ${path}`);
        cancelExport();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [cancelExport, exportLabel, exportStableOnly, setBusy, setError, setStatusMessage]);

  const startImportPreview = useCallback(async () => {
    if (!isTauriRuntime()) {
      setError("浏览器预览无法导入词表包，请在桌面应用中操作。");
      return;
    }
    setBusy(true);
    setError("");
    setStatusMessage("");
    try {
      const result = await bundle.lexiconBundleImportPreview();
      if (result == null) return;
      if (result.preview.conflicts.length === 0) {
        const applied = await bundle.lexiconBundleImportApply(result.bundleJson, []);
        await onImported();
        setStatusMessage(
          `词表包已导入：术语 +${applied.insertedGlossary}，规则 +${applied.insertedRules}，合并 ${applied.mergedRules}，替换 ${applied.replacedRules}。`,
        );
        return;
      }
      const initial: Record<string, LexiconBundleConflictResolution["choice"]> = {};
      for (const c of result.preview.conflicts) {
        initial[c.id] = c.kind === "glossary" ? "local" : "local";
      }
      setResolutions(initial);
      setPendingImport(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [onImported, setBusy, setError, setStatusMessage]);

  const setConflictChoice = useCallback(
    (id: string, choice: LexiconBundleConflictResolution["choice"]) => {
      setResolutions((prev) => ({ ...prev, [id]: choice }));
    },
    [],
  );

  const cancelImport = useCallback(() => {
    setPendingImport(null);
    setResolutions({});
  }, []);

  const confirmImportWithResolutions = useCallback(async () => {
    if (pendingImport == null) return;
    const list: LexiconBundleConflictResolution[] = pendingImport.preview.conflicts.map((c) => ({
      id: c.id,
      choice: resolutions[c.id] ?? "local",
    }));
    setBusy(true);
    setError("");
    try {
      const applied = await bundle.lexiconBundleImportApply(pendingImport.bundleJson, list);
      await onImported();
      setPendingImport(null);
      setResolutions({});
      setStatusMessage(
        `词表包已导入：术语 +${applied.insertedGlossary}，规则 +${applied.insertedRules}，合并 ${applied.mergedRules}，替换 ${applied.replacedRules}。`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [onImported, pendingImport, resolutions, setBusy, setError, setStatusMessage]);

  return {
    exportStableOnly,
    setExportStableOnly: handleExportStableOnlyChange,
    exportLabel,
    setExportLabel,
    exportDialogOpen,
    exportPreview,
    exportPreviewLoading,
    openExportDialog,
    cancelExport,
    confirmExport,
    startImportPreview,
    pendingImport,
    resolutions,
    setConflictChoice,
    cancelImport,
    confirmImportWithResolutions,
  };
}
