import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { groupCorrectionMemoryConflicts } from "../services/correctionMemoryConflicts";
import { useCorrectionMemoryController } from "./useCorrectionMemoryController";
import { useGlossaryController } from "./useGlossaryController";
import { useGlossaryMineController } from "./useGlossaryMineController";
import { useLexiconBundleController } from "./useLexiconBundleController";

export function useGlossaryPageController(busy: boolean) {
  const g = useGlossaryController();
  const mem = useCorrectionMemoryController();
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [bundleBusy, setBundleBusy] = useState(false);
  const [bundleStatus, setBundleStatus] = useState("");
  const [bundleError, setBundleError] = useState("");
  const mine = useGlossaryMineController({
    onGlossaryChanged: () => g.refresh(),
  });
  const lex = useLexiconBundleController({
    onImported: async () => {
      await Promise.all([g.refresh(), mem.refresh()]);
    },
    setError: setBundleError,
    setStatusMessage: setBundleStatus,
    setBusy: setBundleBusy,
  });
  const headerCheckboxRef = useRef<HTMLInputElement>(null);
  const memoryHeaderCheckboxRef = useRef<HTMLInputElement>(null);
  const termEditorRef = useRef<HTMLDivElement>(null);
  const disabled = busy || g.busy || mem.busy || mine.busy || bundleBusy;

  const scrollToTermEditor = useCallback(() => {
    g.resetEditor();
    termEditorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [g]);

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = g.isIndeterminate;
    }
  }, [g.isIndeterminate]);

  useEffect(() => {
    if (memoryHeaderCheckboxRef.current) {
      memoryHeaderCheckboxRef.current.indeterminate = mem.isIndeterminate;
    }
  }, [mem.isIndeterminate]);

  const handleDeleteFromEditor = useCallback(() => {
    if (g.selectedId == null) return;
    void g.remove(g.selectedId);
    setDeleteConfirmId(null);
  }, [g]);

  const memoryConflicts = useMemo(() => groupCorrectionMemoryConflicts(mem.rows), [mem.rows]);

  const handleRowDelete = useCallback(
    (id: number) => {
      if (deleteConfirmId !== id) {
        setDeleteConfirmId(id);
        return;
      }
      setDeleteConfirmId(null);
      void g.remove(id);
    },
    [deleteConfirmId, g],
  );

  return {
    g,
    mem,
    mine,
    lex,
    disabled,
    bundleStatus,
    bundleError,
    deleteConfirmId,
    headerCheckboxRef,
    memoryHeaderCheckboxRef,
    termEditorRef,
    memoryConflicts,
    scrollToTermEditor,
    handleDeleteFromEditor,
    handleRowDelete,
  };
}

export type GlossaryPageController = ReturnType<typeof useGlossaryPageController>;
