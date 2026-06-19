import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GlossaryWorkspaceId } from "../components/glossary/glossaryWorkspaceTypes";
import { groupCorrectionMemoryConflicts } from "../services/correctionMemoryConflicts";

export type { GlossaryWorkspaceId };
import { useCorrectionMemoryController } from "./useCorrectionMemoryController";
import { useGlossaryBulkAddDialog } from "./useGlossaryBulkAddDialog";
import { useGlossaryController } from "./useGlossaryController";
import { useGlossaryMineController } from "./useGlossaryMineController";
import { useLexiconBundleController } from "./useLexiconBundleController";
import type { GlossaryTermDto } from "../tauri/glossaryApi";
import type { CorrectionMemoryEntryRow } from "../tauri/correctionApi";

export function useGlossaryPageController(busy: boolean, workspaceId: GlossaryWorkspaceId) {
  const g = useGlossaryController();
  const bulkAdd = useGlossaryBulkAddDialog(g);
  const mem = useCorrectionMemoryController();
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
  const disabled = busy || g.busy || mem.busy || mine.busy || bundleBusy;

  // 仅在工作区分段切换时重置；勿将 g/mem 放入 deps（对象引用每轮变化会立刻关掉编辑器/对话框）
  /* eslint-disable react-hooks/exhaustive-deps -- g/mem/bulkAdd are stable controller objects; workspaceId is the only trigger */
  useEffect(() => {
    setTermEditorOpen(false);
    setMemEditorOpen(false);
    bulkAdd.closeDialog();
    g.resetEditor();
    mem.resetEditor();
  }, [workspaceId]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const openTermEditor = useCallback(() => {
    g.resetEditor();
    setTermEditorOpen(true);
  }, [g]);

  const closeTermEditor = useCallback(() => {
    g.resetEditor();
    setTermEditorOpen(false);
  }, [g]);

  const handleSelectTerm = useCallback(
    (row: GlossaryTermDto) => {
      g.selectTerm(row);
      setTermEditorOpen(true);
    },
    [g],
  );

  const openMemEditor = useCallback(() => {
    mem.resetEditor();
    setMemEditorOpen(true);
  }, [mem]);

  const closeMemEditor = useCallback(() => {
    mem.resetEditor();
    setMemEditorOpen(false);
  }, [mem]);

  const handleSelectMemoryRow = useCallback(
    (row: CorrectionMemoryEntryRow) => {
      mem.selectRow(row);
      setMemEditorOpen(true);
    },
    [mem],
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
    setTermEditorOpen(false);
  }, [g]);

  const memoryConflicts = useMemo(() => groupCorrectionMemoryConflicts(mem.rows), [mem.rows]);

  return {
    g,
    mem,
    mine,
    lex,
    workspaceId,
    disabled,
    bundleStatus,
    bundleError,
    headerCheckboxRef,
    memoryHeaderCheckboxRef,
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
    bulkAddDialogOpen: bulkAdd.open,
    openBulkAddDialog: bulkAdd.openDialog,
    closeBulkAddDialog: bulkAdd.closeDialog,
    handleBulkAddConfirm: bulkAdd.confirm,
    handleBulkImportFromFile: bulkAdd.importFromFile,
  };
}

export type GlossaryPageController = ReturnType<typeof useGlossaryPageController>;
