import { useCallback, useEffect, useMemo, useState } from "react";
import { batchHotwordMessage, batchResultMessage } from "../services/glossaryTermHelpers";
import type { GlossaryTermDto } from "../tauri/glossaryApi";
import * as g from "../tauri/glossaryApi";
import { useGlossaryBatchSelection } from "./useGlossaryBatchSelection";

type UseGlossaryBatchActionsArgs = {
  terms: GlossaryTermDto[];
  filteredIds: number[];
  visibleIds: number[];
  visibleIdSet: Set<number>;
  searchQuery: string;
  hotwordFilter: string;
  selectedId: number | null;
  refresh: () => Promise<void>;
  resetEditor: () => void;
  syncDraftHotword: (enabled: boolean) => void;
  setStatusMessage: (msg: string) => void;
  setError: (msg: string) => void;
  setBusy: (busy: boolean) => void;
};

export function useGlossaryBatchActions({
  terms,
  filteredIds,
  visibleIds,
  visibleIdSet,
  searchQuery,
  hotwordFilter,
  selectedId,
  refresh,
  resetEditor,
  syncDraftHotword,
  setStatusMessage,
  setError,
  setBusy,
}: UseGlossaryBatchActionsArgs) {
  const [batchDeleteConfirm, setBatchDeleteConfirm] = useState(false);

  const {
    checkedIds,
    selectedCount,
    selectedIdArray,
    toggleChecked,
    clearSelection,
    removeFromSelection,
    isAllVisibleSelected,
    toggleVisibleSelection,
    selectAllFiltered,
    pruneCheckedIds,
  } = useGlossaryBatchSelection(visibleIds);

  const checkedIdSet = useMemo(() => new Set(checkedIds), [checkedIds]);

  const idsToEnable = useMemo(
    () => terms.filter((t) => checkedIdSet.has(t.id) && t.hotword_enabled === false).map((t) => t.id),
    [terms, checkedIdSet],
  );

  const idsToDisable = useMemo(
    () => terms.filter((t) => checkedIdSet.has(t.id) && t.hotword_enabled !== false).map((t) => t.id),
    [terms, checkedIdSet],
  );

  useEffect(() => {
    pruneCheckedIds(new Set(terms.map((row) => row.id)));
  }, [terms, pruneCheckedIds]);

  useEffect(() => {
    clearSelection();
    setBatchDeleteConfirm(false);
  }, [searchQuery, hotwordFilter, clearSelection]);

  const batchDelete = useCallback(async () => {
    const ids = selectedIdArray;
    if (ids.length === 0) return;
    if (!batchDeleteConfirm) {
      setBatchDeleteConfirm(true);
      return;
    }
    setBusy(true);
    setError("");
    setBatchDeleteConfirm(false);
    try {
      const result = await g.glossaryDeleteBatch(ids);
      if (selectedId != null && ids.includes(selectedId)) {
        resetEditor();
      }
      clearSelection();
      await refresh();
      setStatusMessage(batchResultMessage("已删除", result.requested, result.affected));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [
    batchDeleteConfirm,
    clearSelection,
    refresh,
    resetEditor,
    selectedId,
    selectedIdArray,
    setBusy,
    setError,
    setStatusMessage,
  ]);

  const batchSetHotword = useCallback(
    async (enabled: boolean) => {
      const ids = enabled ? idsToEnable : idsToDisable;
      if (ids.length === 0) return;
      setBusy(true);
      setError("");
      setBatchDeleteConfirm(false);
      try {
        const result = await g.glossarySetHotwordBatch(ids, enabled);
        if (selectedId != null && ids.includes(selectedId)) {
          syncDraftHotword(enabled);
        }
        await refresh();
        setStatusMessage(batchHotwordMessage(enabled, result.requested, result.affected));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [idsToEnable, idsToDisable, refresh, selectedId, setBusy, setError, setStatusMessage, syncDraftHotword],
  );

  const toggleRowHotword = useCallback(
    async (row: GlossaryTermDto) => {
      const enabled = row.hotword_enabled === false;
      setBusy(true);
      setError("");
      try {
        const result = await g.glossarySetHotwordBatch([row.id], enabled);
        if (selectedId === row.id) {
          syncDraftHotword(enabled);
        }
        await refresh();
        if (result.affected === 0) {
          setError("未能更新该术语的热词状态。");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [refresh, selectedId, setBusy, setError, syncDraftHotword],
  );

  const selectFiltered = useCallback(() => {
    selectAllFiltered(filteredIds);
    setBatchDeleteConfirm(false);
  }, [filteredIds, selectAllFiltered]);

  const isIndeterminate =
    selectedCount > 0 &&
    visibleIds.length > 0 &&
    !isAllVisibleSelected &&
    visibleIds.some((id) => checkedIds.has(id));

  const hiddenSelectedCount = Array.from(checkedIds).filter((id) => !visibleIdSet.has(id)).length;

  return {
    checkedIds,
    selectedCount,
    toggleChecked,
    clearSelection,
    removeFromSelection,
    isAllVisibleSelected,
    toggleVisibleSelection,
    selectFiltered,
    batchDeleteConfirm,
    clearBatchDeleteConfirm: () => setBatchDeleteConfirm(false),
    batchDelete,
    batchSetHotword,
    toggleRowHotword,
    isIndeterminate,
    hiddenSelectedCount,
    canEnableHotwords: idsToEnable.length > 0,
    canDisableHotwords: idsToDisable.length > 0,
  };
}
