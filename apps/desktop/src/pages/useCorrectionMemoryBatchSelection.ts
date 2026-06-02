import { useCallback, useMemo, useState } from "react";

export function useCorrectionMemoryBatchSelection(visibleRowKeys: string[]) {
  const [checkedKeys, setCheckedKeys] = useState<Set<string>>(() => new Set());

  const pruneCheckedKeys = useCallback((validKeys: Set<string>) => {
    setCheckedKeys((prev) => {
      const next = new Set<string>();
      for (const key of prev) {
        if (validKeys.has(key)) next.add(key);
      }
      return next.size === prev.size ? prev : next;
    });
  }, []);

  const toggleChecked = useCallback((rowKey: string) => {
    setCheckedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(rowKey)) next.delete(rowKey);
      else next.add(rowKey);
      return next;
    });
  }, []);

  const selectAllVisible = useCallback(() => {
    setCheckedKeys(new Set(visibleRowKeys));
  }, [visibleRowKeys]);

  const selectAllFiltered = useCallback((filteredKeys: string[]) => {
    setCheckedKeys(new Set(filteredKeys));
  }, []);

  const clearSelection = useCallback(() => {
    setCheckedKeys(new Set());
  }, []);

  const isAllVisibleSelected =
    visibleRowKeys.length > 0 && visibleRowKeys.every((key) => checkedKeys.has(key));

  const toggleVisibleSelection = useCallback(() => {
    if (isAllVisibleSelected) clearSelection();
    else selectAllVisible();
  }, [clearSelection, isAllVisibleSelected, selectAllVisible]);

  const removeFromSelection = useCallback((rowKey: string) => {
    setCheckedKeys((prev) => {
      if (!prev.has(rowKey)) return prev;
      const next = new Set(prev);
      next.delete(rowKey);
      return next;
    });
  }, []);

  const selectedKeyArray = useMemo(() => Array.from(checkedKeys), [checkedKeys]);

  return {
    checkedKeys,
    selectedCount: checkedKeys.size,
    selectedKeyArray,
    toggleChecked,
    selectAllFiltered,
    clearSelection,
    removeFromSelection,
    isAllVisibleSelected,
    toggleVisibleSelection,
    pruneCheckedKeys,
  };
}
