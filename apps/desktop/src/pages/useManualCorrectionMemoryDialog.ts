import { useCallback, useState } from "react";
import {
  saveManualCorrectionMemoryPair,
  validateManualCorrectionMemoryPair,
} from "../services/manualCorrectionMemory";
import {
  formatPromoteToGlossaryToast,
  promoteAfterTextsToGlossary,
} from "../services/promoteLearnPairToGlossary";
import { toast } from "../services/ui/toast";

export type ManualCorrectionMemoryDialogState =
  | { phase: "closed" }
  | {
      phase: "confirm";
      wrong: string;
      right: string;
      alsoAddToGlossary: boolean;
    };

type Args = {
  busy: boolean;
  setError: (msg: string) => void;
  /** F6：纳入记忆后，仅针对本次正形检查 hit≥阈值是否应弹出进术语表提示。 */
  checkGlossaryLearnAfterSave?: (focusAfterTexts: readonly string[]) => void | Promise<void>;
};

export function useManualCorrectionMemoryDialog({
  busy,
  setError,
  checkGlossaryLearnAfterSave,
}: Args) {
  const [dialog, setDialog] = useState<ManualCorrectionMemoryDialogState>({ phase: "closed" });

  const openManualCorrectionMemoryDialog = useCallback((wrong: string) => {
    const trimmed = wrong.trim();
    if (!trimmed) return;
    setError("");
    setDialog({ phase: "confirm", wrong: trimmed, right: "", alsoAddToGlossary: false });
  }, [setError]);

  const closeManualCorrectionMemoryDialog = useCallback(() => {
    setDialog({ phase: "closed" });
  }, []);

  const setManualCorrectionRight = useCallback((right: string) => {
    setDialog((prev) => (prev.phase === "confirm" ? { ...prev, right } : prev));
  }, []);

  const setManualCorrectionAlsoGlossary = useCallback((alsoAddToGlossary: boolean) => {
    setDialog((prev) => (prev.phase === "confirm" ? { ...prev, alsoAddToGlossary } : prev));
  }, []);

  const confirmManualCorrectionMemory = useCallback(async () => {
    if (dialog.phase !== "confirm" || busy) return;
    const validation = validateManualCorrectionMemoryPair(dialog.wrong, dialog.right);
    if (!validation.ok) {
      setError(validation.reason);
      return;
    }
    setError("");
    try {
      await saveManualCorrectionMemoryPair(validation.beforeText, validation.afterText);
      if (dialog.alsoAddToGlossary) {
        const promoted = await promoteAfterTextsToGlossary([validation.afterText]);
        const msg = formatPromoteToGlossaryToast(promoted);
        if (msg) toast.success(msg);
      }
      toast.success(`已纳入纠错记忆：「${validation.beforeText}」→「${validation.afterText}」`);
      setDialog({ phase: "closed" });
      void checkGlossaryLearnAfterSave?.([validation.afterText]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [busy, dialog, setError, checkGlossaryLearnAfterSave]);

  return {
    manualCorrectionMemoryDialog: dialog,
    openManualCorrectionMemoryDialog,
    closeManualCorrectionMemoryDialog,
    setManualCorrectionRight,
    setManualCorrectionAlsoGlossary,
    confirmManualCorrectionMemory,
  };
}
