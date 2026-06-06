import { useCallback, useEffect, useMemo, useState } from "react";
import type { CorrectionMemoryEntryRow } from "../tauri/correctionApi";
import {
  correctionMemoryRowKey,
  keyToCorrectionMemoryKey,
  selectedCorrectionMemoryPreviewLabels,
  type CorrectionMemoryKey,
} from "../services/correctionMemoryHelpers";
import { useCorrectionMemoryBatchSelection } from "./useCorrectionMemoryBatchSelection";

type BatchSelection = ReturnType<typeof useCorrectionMemoryBatchSelection>;

type Args = {
  rows: CorrectionMemoryEntryRow[];
  visibleRowKeys: string[];
  searchQuery: string;
  batch: BatchSelection;
  removeRows: (keys: CorrectionMemoryKey[]) => Promise<void>;
  acceptRows: (targets: CorrectionMemoryEntryRow[]) => Promise<void>;
};

export function useCorrectionMemoryBatchUi({
  rows,
  visibleRowKeys,
  searchQuery,
  batch,
  removeRows,
  acceptRows,
}: Args) {
  const [batchDeleteConfirm, setBatchDeleteConfirm] = useState(false);

  const {
    checkedKeys,
    selectedCount,
    selectedKeyArray,
    toggleChecked,
    selectAllFiltered,
    clearSelection,
    isAllVisibleSelected,
    toggleVisibleSelection,
    pruneCheckedKeys,
  } = batch;

  const visibleRowKeySet = useMemo(() => new Set(visibleRowKeys), [visibleRowKeys]);

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
    selectAllFiltered(visibleRowKeys);
    setBatchDeleteConfirm(false);
  }, [selectAllFiltered, visibleRowKeys]);

  return {
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
