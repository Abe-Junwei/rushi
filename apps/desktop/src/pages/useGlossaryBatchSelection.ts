import { useCallback, useMemo, useState } from "react";

export function useGlossaryBatchSelection(visibleIds: number[]) {
  const [checkedIds, setCheckedIds] = useState<Set<number>>(() => new Set());

  const pruneCheckedIds = useCallback((validIds: Set<number>) => {
    setCheckedIds((prev) => {
      const next = new Set<number>();
      for (const id of prev) {
        if (validIds.has(id)) next.add(id);
      }
      return next.size === prev.size ? prev : next;
    });
  }, []);

  const toggleChecked = useCallback((id: number) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAllVisible = useCallback(() => {
    setCheckedIds(new Set(visibleIds));
  }, [visibleIds]);

  const selectAllFiltered = useCallback(
    (filteredIds: number[]) => {
      setCheckedIds(new Set(filteredIds));
    },
    [],
  );

  const clearSelection = useCallback(() => {
    setCheckedIds(new Set());
  }, []);

  const isAllVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => checkedIds.has(id));

  const toggleVisibleSelection = useCallback(() => {
    if (isAllVisibleSelected) clearSelection();
    else selectAllVisible();
  }, [clearSelection, isAllVisibleSelected, selectAllVisible]);

  const removeFromSelection = useCallback((id: number) => {
    setCheckedIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const selectedIdArray = useMemo(() => Array.from(checkedIds), [checkedIds]);

  return {
    checkedIds,
    selectedCount: checkedIds.size,
    selectedIdArray,
    toggleChecked,
    selectAllVisible,
    selectAllFiltered,
    clearSelection,
    removeFromSelection,
    isAllVisibleSelected,
    toggleVisibleSelection,
    pruneCheckedIds,
  };
}
