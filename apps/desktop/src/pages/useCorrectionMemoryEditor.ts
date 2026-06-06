import { useCallback, useState } from "react";
import { correctionMemorySave, type CorrectionMemoryEntryRow } from "../tauri/correctionApi";
import {
  EMPTY_CORRECTION_MEMORY_DRAFT,
  type CorrectionMemoryDraft,
  type CorrectionMemoryKey,
} from "../services/correctionMemoryHelpers";

type Args = {
  refresh: () => Promise<void>;
  setLoadError: (msg: string) => void;
  setBusy: (busy: boolean) => void;
  setStatusMessage: (msg: string) => void;
};

export function useCorrectionMemoryEditor({
  refresh,
  setLoadError,
  setBusy,
  setStatusMessage,
}: Args) {
  const [selectedKey, setSelectedKey] = useState<CorrectionMemoryKey | null>(null);
  const [draft, setDraft] = useState<CorrectionMemoryDraft>(EMPTY_CORRECTION_MEMORY_DRAFT);

  const editorMode = selectedKey ? ("edit" as const) : ("create" as const);

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
  }, [setStatusMessage]);

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
  }, [draft, refresh, resetEditor, selectedKey, setBusy, setLoadError, setStatusMessage]);

  const syncAcceptedAsRule = useCallback(() => {
    setDraft((prev) => ({ ...prev, acceptedAsRule: true }));
  }, []);

  return {
    selectedKey,
    draft,
    editorMode,
    resetEditor,
    selectRow,
    updateDraftField,
    saveDraft,
    syncAcceptedAsRule,
  };
}
