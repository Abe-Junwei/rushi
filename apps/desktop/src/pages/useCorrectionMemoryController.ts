import { useCallback, useEffect, useMemo, useState } from "react";
import {
  correctionAcceptRule,
  correctionMemoryDelete,
  correctionMemoryList,
  correctionMemorySave,
  type CorrectionMemoryEntryRow,
} from "../tauri/correctionApi";
import {
  correctionMemoryRowKey,
  EMPTY_CORRECTION_MEMORY_DRAFT,
  filterCorrectionMemoryRows,
  keyToCorrectionMemoryKey,
  sameCorrectionMemoryKey,
  selectedCorrectionMemoryPreviewLabels,
  type CorrectionMemoryDraft,
  type CorrectionMemoryKey,
} from "../services/correctionMemoryHelpers";
import { useCorrectionMemoryBatchSelection } from "./useCorrectionMemoryBatchSelection";

export function useCorrectionMemoryController() {
  const [rows, setRows] = useState<CorrectionMemoryEntryRow[]>([]);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState<CorrectionMemoryKey | null>(null);
  const [draft, setDraft] = useState<CorrectionMemoryDraft>(EMPTY_CORRECTION_MEMORY_DRAFT);
  const [batchDeleteConfirm, setBatchDeleteConfirm] = useState(false);

  const refresh = useCallback(async () => {
    setLoadError("");
    try {
      const list = await correctionMemoryList();
      setRows(list);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filteredRows = useMemo(
    () => filterCorrectionMemoryRows(rows, searchQuery),
    [rows, searchQuery],
  );

  const visibleRowKeys = useMemo(
    () => filteredRows.map((row) => correctionMemoryRowKey(row)),
    [filteredRows],
  );

  const filteredRowKeys = useMemo(
    () => filterCorrectionMemoryRows(rows, searchQuery).map((row) => correctionMemoryRowKey(row)),
    [rows, searchQuery],
  );

  const visibleRowKeySet = useMemo(() => new Set(visibleRowKeys), [visibleRowKeys]);

  const batch = useCorrectionMemoryBatchSelection(visibleRowKeys);

  const {
    checkedKeys,
    selectedCount,
    selectedKeyArray,
    toggleChecked,
    selectAllFiltered,
    clearSelection,
    removeFromSelection,
    isAllVisibleSelected,
    toggleVisibleSelection,
    pruneCheckedKeys,
  } = batch;

  const stableCount = useMemo(() => rows.filter((r) => r.isStable).length, [rows]);

  const editorMode = selectedKey ? ("edit" as const) : ("create" as const);

  const selectedRows = useMemo(() => {
    const out: CorrectionMemoryEntryRow[] = [];
    for (const key of selectedKeyArray) {
      const parsed = keyToCorrectionMemoryKey(key);
      if (!parsed) continue;
      const row = rows.find(
        (r) => r.wrong === parsed.wrong && r.right === parsed.right,
      );
      if (row) out.push(row);
    }
    return out;
  }, [selectedKeyArray, rows]);

  const rowsToAccept = useMemo(
    () => selectedRows.filter((r) => !r.acceptedAsRule),
    [selectedRows],
  );

  const previewLabels = useMemo(
    () => selectedCorrectionMemoryPreviewLabels(rows, checkedKeys),
    [checkedKeys, rows],
  );

  const hiddenSelectedCount = useMemo(
    () => selectedKeyArray.filter((key) => !visibleRowKeySet.has(key)).length,
    [selectedKeyArray, visibleRowKeySet],
  );

  const isIndeterminate =
    selectedCount > 0 &&
    visibleRowKeys.length > 0 &&
    !isAllVisibleSelected &&
    visibleRowKeys.some((key) => checkedKeys.has(key));

  useEffect(() => {
    pruneCheckedKeys(new Set(rows.map((row) => correctionMemoryRowKey(row))));
  }, [pruneCheckedKeys, rows]);

  useEffect(() => {
    clearSelection();
    setBatchDeleteConfirm(false);
  }, [clearSelection, searchQuery]);

  useEffect(() => {
    setBatchDeleteConfirm(false);
  }, [selectedCount, selectedKeyArray]);

  const resetEditor = useCallback(() => {
    setSelectedKey(null);
    setDraft(EMPTY_CORRECTION_MEMORY_DRAFT);
  }, []);

  const selectRow = useCallback((row: CorrectionMemoryEntryRow) => {
    setSelectedKey({ wrong: row.wrong, right: row.right });
    setDraft({
      wrong: row.wrong,
      right: row.right,
      acceptedAsRule: row.acceptedAsRule,
    });
    setStatusMessage("");
  }, []);

  const updateDraftField = useCallback(
    (key: keyof CorrectionMemoryDraft, value: string | boolean) => {
      setDraft((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const saveDraft = useCallback(async () => {
    setBusy(true);
    setStatusMessage("");
    setLoadError("");
    try {
      await correctionMemorySave({
        wrong: draft.wrong,
        right: draft.right,
        acceptedAsRule: draft.acceptedAsRule,
        replaceWrong: selectedKey?.wrong,
        replaceRight: selectedKey?.right,
      });
      await refresh();
      setStatusMessage(selectedKey ? "已更新纠错记忆" : "已添加纠错记忆");
      resetEditor();
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [draft, refresh, resetEditor, selectedKey]);

  const removeRows = useCallback(
    async (keys: CorrectionMemoryKey[]) => {
      if (!keys.length) return;
      setBusy(true);
      setLoadError("");
      try {
        let deleted = 0;
        for (const key of keys) {
          await correctionMemoryDelete(key.wrong, key.right);
          removeFromSelection(correctionMemoryRowKey(key));
          deleted += 1;
        }
        if (selectedKey && keys.some((k) => sameCorrectionMemoryKey(selectedKey, k))) {
          resetEditor();
        }
        await refresh();
        setStatusMessage(
          deleted === 1 ? "已删除 1 条纠错记忆" : `已删除 ${deleted} 条纠错记忆`,
        );
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [refresh, removeFromSelection, resetEditor, selectedKey],
  );

  const removeRow = useCallback(
    async (key: CorrectionMemoryKey) => {
      await removeRows([key]);
    },
    [removeRows],
  );

  const acceptRows = useCallback(
    async (targets: CorrectionMemoryEntryRow[]) => {
      if (!targets.length) return;
      setBusy(true);
      setLoadError("");
      try {
        for (const row of targets) {
          await correctionAcceptRule(row.wrong, row.right);
        }
        await refresh();
        if (
          selectedKey &&
          targets.some(
            (r) => r.wrong === selectedKey.wrong && r.right === selectedKey.right,
          )
        ) {
          setDraft((prev) => ({ ...prev, acceptedAsRule: true }));
        }
        setStatusMessage(
          targets.length === 1
            ? `已采纳规则：${targets[0].wrong} → ${targets[0].right}`
            : `已采纳 ${targets.length} 条为规则`,
        );
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [refresh, selectedKey],
  );

  const acceptAsRule = useCallback(
    async (row: CorrectionMemoryEntryRow) => {
      await acceptRows([row]);
    },
    [acceptRows],
  );

  const batchDelete = useCallback(async () => {
    if (selectedRows.length === 0) return;
    if (!batchDeleteConfirm) {
      setBatchDeleteConfirm(true);
      return;
    }
    setBatchDeleteConfirm(false);
    const keys = selectedRows.map((r) => ({ wrong: r.wrong, right: r.right }));
    clearSelection();
    await removeRows(keys);
  }, [batchDeleteConfirm, clearSelection, removeRows, selectedRows]);

  const batchAcceptRules = useCallback(async () => {
    await acceptRows(rowsToAccept);
  }, [acceptRows, rowsToAccept]);

  const selectFiltered = useCallback(() => {
    selectAllFiltered(filteredRowKeys);
    setBatchDeleteConfirm(false);
  }, [filteredRowKeys, selectAllFiltered]);

  return {
    rows,
    filteredRows,
    stableCount,
    loadError,
    busy,
    statusMessage,
    searchQuery,
    setSearchQuery,
    selectedKey,
    draft,
    editorMode,
    refresh,
    resetEditor,
    selectRow,
    updateDraftField,
    saveDraft,
    removeRow,
    acceptAsRule,
    checkedKeys,
    selectedCount,
    toggleChecked,
    isAllVisibleSelected,
    isIndeterminate,
    toggleVisibleSelection,
    selectFiltered,
    batchDeleteConfirm,
    clearBatchDeleteConfirm: () => setBatchDeleteConfirm(false),
    batchDelete,
    batchAcceptRules,
    clearSelection,
    previewLabels,
    hiddenSelectedCount,
    canAcceptRules: rowsToAccept.length > 0,
  };
}
