import { useCallback, useState } from "react";
import { formatGlossaryHotwordsTranscribeSummary } from "../services/glossaryHotwords";
import { selectedGlossaryPreviewLabels } from "../services/glossaryTermHelpers";
import { useGlossaryBatchActions } from "./useGlossaryBatchActions";
import { useGlossaryEditor } from "./useGlossaryEditor";
import { useGlossaryImportExport } from "./useGlossaryImportExport";
import { useGlossaryListData } from "./useGlossaryListData";

export type GlossaryControllerApi = ReturnType<typeof useGlossaryController>;

export function useGlossaryController() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const list = useGlossaryListData();

  const editor = useGlossaryEditor(list.refresh, setError, setStatusMessage, setBusy);

  const batch = useGlossaryBatchActions({
    terms: list.terms,
    filteredIds: list.filteredTerms.map((row) => row.id),
    visibleIds: list.visibleIds,
    visibleIdSet: list.visibleIdSet,
    searchQuery: list.searchQuery,
    hotwordFilter: list.hotwordFilter,
    selectedId: editor.selectedId,
    refresh: list.refresh,
    resetEditor: editor.resetEditor,
    syncDraftHotword: editor.syncDraftHotword,
    setStatusMessage,
    setError,
    setBusy,
  });

  const importExport = useGlossaryImportExport(list.terms, list.refresh, setError, setStatusMessage, setBusy);

  const remove = useCallback(
    (id: number) => {
      void editor.remove(id, batch.removeFromSelection);
    },
    [batch.removeFromSelection, editor],
  );

  const hotwordsSummary = formatGlossaryHotwordsTranscribeSummary(list.hotwordsPreview);
  const selectedPreviewLabels = selectedGlossaryPreviewLabels(list.terms, batch.checkedIds);

  return {
    ...list,
    ...editor,
    ...batch,
    ...importExport,
    busy,
    error: error || list.loadError,
    statusMessage,
    hotwordsSummary,
    selectedPreviewLabels,
    refresh: list.refresh,
    remove,
  };
}
