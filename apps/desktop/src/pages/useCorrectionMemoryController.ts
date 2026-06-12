import { useState } from "react";
import { useCorrectionMemoryBatchSelection } from "./useCorrectionMemoryBatchSelection";
import { useCorrectionMemoryBatchUi } from "./useCorrectionMemoryBatchUi";
import { useCorrectionMemoryEditor } from "./useCorrectionMemoryEditor";
import { useCorrectionMemoryListData } from "./useCorrectionMemoryListData";
import { useCorrectionMemoryMutations } from "./useCorrectionMemoryMutations";

export function useCorrectionMemoryController() {
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const list = useCorrectionMemoryListData();
  const batchSelection = useCorrectionMemoryBatchSelection(list.visibleRowKeys);

  const editor = useCorrectionMemoryEditor({
    refresh: list.refresh,
    setLoadError: list.setLoadError,
    setBusy,
    setStatusMessage,
  });

  const mutations = useCorrectionMemoryMutations({
    refresh: list.refresh,
    setLoadError: list.setLoadError,
    setBusy,
    setStatusMessage,
    selectedKey: editor.selectedKey,
    resetEditor: editor.resetEditor,
    removeFromSelection: batchSelection.removeFromSelection,
    syncAcceptedAsRule: editor.syncAcceptedAsRule,
  });

  const batchUi = useCorrectionMemoryBatchUi({
    rows: list.rows,
    visibleRowKeys: list.visibleRowKeys,
    searchQuery: list.searchQuery,
    batch: batchSelection,
    removeRows: mutations.removeRows,
    acceptRows: mutations.acceptRows,
  });

  return {
    rows: list.rows,
    filteredRows: list.filteredRows,
    stableCount: list.stableCount,
    loadError: list.loadError,
    busy,
    statusMessage,
    searchQuery: list.searchQuery,
    setSearchQuery: list.setSearchQuery,
    sortMode: list.sortMode,
    setSortMode: list.setSortMode,
    selectedKey: editor.selectedKey,
    draft: editor.draft,
    editorMode: editor.editorMode,
    refresh: list.refresh,
    resetEditor: editor.resetEditor,
    selectRow: editor.selectRow,
    updateDraftField: editor.updateDraftField,
    saveDraft: editor.saveDraft,
    removeRow: mutations.removeRow,
    acceptAsRule: mutations.acceptAsRule,
    checkedKeys: batchUi.checkedKeys,
    selectedCount: batchUi.selectedCount,
    toggleChecked: batchUi.toggleChecked,
    isAllVisibleSelected: batchUi.isAllVisibleSelected,
    isIndeterminate: batchUi.isIndeterminate,
    toggleVisibleSelection: batchUi.toggleVisibleSelection,
    selectFiltered: batchUi.selectFiltered,
    batchDeleteConfirm: batchUi.batchDeleteConfirm,
    clearBatchDeleteConfirm: batchUi.clearBatchDeleteConfirm,
    batchDelete: batchUi.batchDelete,
    batchAcceptRules: batchUi.batchAcceptRules,
    clearSelection: batchUi.clearSelection,
    previewLabels: batchUi.previewLabels,
    hiddenSelectedCount: batchUi.hiddenSelectedCount,
    canAcceptRules: batchUi.canAcceptRules,
  };
}
