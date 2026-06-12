import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { groupCorrectionMemoryConflicts } from "../services/correctionMemoryConflicts";
import { useCorrectionMemoryController } from "./useCorrectionMemoryController";
import { useGlossaryController } from "./useGlossaryController";
import { useGlossaryMineController } from "./useGlossaryMineController";
import { useLexiconBundleController } from "./useLexiconBundleController";
import type { GlossaryTermDto } from "../tauri/glossaryApi";
import type { CorrectionMemoryEntryRow } from "../tauri/correctionApi";

export function useGlossaryPageController(busy: boolean) {
  const g = useGlossaryController();
  const mem = useCorrectionMemoryController();
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [termEditorOpen, setTermEditorOpen] = useState(false);
  const [memEditorOpen, setMemEditorOpen] = useState(false);
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
  const memoryEditorRef = useRef<HTMLDivElement>(null);
  const disabled = busy || g.busy || mem.busy || mine.busy || bundleBusy;

  const scrollIntoViewSoon = useCallback((ref: React.RefObject<HTMLDivElement | null>) => {
    // 编辑器折叠展开后下一帧才有布局，再滚动到位
    requestAnimationFrame(() => {
      ref.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, []);

  const openTermEditor = useCallback(() => {
    g.resetEditor();
    setTermEditorOpen(true);
    scrollIntoViewSoon(termEditorRef);
  }, [g, scrollIntoViewSoon]);

  const closeTermEditor = useCallback(() => {
    g.resetEditor();
    setTermEditorOpen(false);
  }, [g]);

  const handleSelectTerm = useCallback(
    (row: GlossaryTermDto) => {
      g.selectTerm(row);
      setTermEditorOpen(true);
      scrollIntoViewSoon(termEditorRef);
    },
    [g, scrollIntoViewSoon],
  );

  const openMemEditor = useCallback(() => {
    mem.resetEditor();
    setMemEditorOpen(true);
    scrollIntoViewSoon(memoryEditorRef);
  }, [mem, scrollIntoViewSoon]);

  const closeMemEditor = useCallback(() => {
    mem.resetEditor();
    setMemEditorOpen(false);
  }, [mem]);

  const handleSelectMemoryRow = useCallback(
    (row: CorrectionMemoryEntryRow) => {
      mem.selectRow(row);
      setMemEditorOpen(true);
      scrollIntoViewSoon(memoryEditorRef);
    },
    [mem, scrollIntoViewSoon],
  );

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
    setTermEditorOpen(false);
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
    memoryEditorRef,
    memoryConflicts,
    termEditorOpen,
    openTermEditor,
    closeTermEditor,
    handleSelectTerm,
    memEditorOpen,
    openMemEditor,
    closeMemEditor,
    handleSelectMemoryRow,
    handleDeleteFromEditor,
    handleRowDelete,
  };
}

export type GlossaryPageController = ReturnType<typeof useGlossaryPageController>;
