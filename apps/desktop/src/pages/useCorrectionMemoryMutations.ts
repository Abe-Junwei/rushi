import { useCallback } from "react";
import {
  correctionAcceptRule,
  correctionMemoryDelete,
  type CorrectionMemoryEntryRow,
} from "../tauri/correctionApi";
import {
  correctionMemoryRowKey,
  sameCorrectionMemoryKey,
  type CorrectionMemoryKey,
} from "../services/correctionMemoryHelpers";

type Args = {
  refresh: () => Promise<void>;
  setLoadError: (msg: string) => void;
  setBusy: (busy: boolean) => void;
  setStatusMessage: (msg: string) => void;
  selectedKey: CorrectionMemoryKey | null;
  resetEditor: () => void;
  removeFromSelection: (rowKey: string) => void;
  syncAcceptedAsRule: () => void;
};

export function useCorrectionMemoryMutations({
  refresh,
  setLoadError,
  setBusy,
  setStatusMessage,
  selectedKey,
  resetEditor,
  removeFromSelection,
  syncAcceptedAsRule,
}: Args) {
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
    [refresh, removeFromSelection, resetEditor, selectedKey, setBusy, setLoadError, setStatusMessage],
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
          syncAcceptedAsRule();
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
    [refresh, selectedKey, setBusy, setLoadError, setStatusMessage, syncAcceptedAsRule],
  );

  const acceptAsRule = useCallback(
    async (row: CorrectionMemoryEntryRow) => {
      await acceptRows([row]);
    },
    [acceptRows],
  );

  return { removeRows, removeRow, acceptRows, acceptAsRule };
}
