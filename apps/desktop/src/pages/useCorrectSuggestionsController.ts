import { useCallback, useState } from "react";
import { correctionStableRulesList } from "../tauri/correctionApi";
import { glossaryList } from "../tauri/glossaryApi";
import {
  filterCorrectSuggestions,
  type CorrectSuggestion,
} from "../services/editor/correctSuggestions";
import { readTranscriptTextareaSelection } from "../utils/transcriptSelection";
import { toast } from "../services/ui/toast";

export type CorrectSuggestionsDialogState =
  | { phase: "closed" }
  | { phase: "loading"; selection: string }
  | { phase: "results"; selection: string; items: CorrectSuggestion[] }
  | { phase: "empty"; selection: string };

type Args = {
  busy: boolean;
  currentFileId: string | null;
  openFindReplace: (initialFind?: string, initialReplace?: string) => void;
  setError: (msg: string) => void;
};

export function useCorrectSuggestionsController(args: Args) {
  const { busy, currentFileId, openFindReplace, setError } = args;
  const [dialog, setDialog] = useState<CorrectSuggestionsDialogState>({ phase: "closed" });

  const blockReason = !currentFileId
    ? "请先打开一个文件"
    : busy
      ? "处理中，请稍候"
      : null;

  const canCorrectSuggestions = blockReason === null;

  const requestCorrectSuggestions = useCallback(
    async (selectionOverride?: string) => {
      if (!canCorrectSuggestions) return;
      const selection = (selectionOverride ?? readTranscriptTextareaSelection()).trim();
      if (!selection) {
        setError("");
        toast.warning("请先在语段正文中选中要改正的文字");
        return;
      }
      setDialog({ phase: "loading", selection });
      setError("");
      try {
        const [rules, glossary] = await Promise.all([correctionStableRulesList(), glossaryList()]);
        const items = filterCorrectSuggestions(selection, rules, glossary);
        if (!items.length) {
          setDialog({ phase: "empty", selection });
          return;
        }
        setDialog({ phase: "results", selection, items });
      } catch (e) {
        setDialog({ phase: "closed" });
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [canCorrectSuggestions, openFindReplace, setError],
  );

  const applyCorrectSuggestion = useCallback(
    (item: CorrectSuggestion) => {
      if (item.kind === "rule") {
        openFindReplace(item.wrong, item.right);
      } else {
        openFindReplace(item.term);
      }
      setDialog({ phase: "closed" });
    },
    [openFindReplace],
  );

  const cancelCorrectSuggestions = useCallback(() => {
    setDialog({ phase: "closed" });
  }, []);

  const openFindReplaceForCorrectSelection = useCallback(() => {
    if (dialog.phase !== "empty") return;
    openFindReplace(dialog.selection);
    setDialog({ phase: "closed" });
  }, [dialog, openFindReplace]);

  return {
    canCorrectSuggestions,
    correctSuggestionsBlockReason: blockReason,
    correctSuggestionsDialog: dialog,
    requestCorrectSuggestions,
    applyCorrectSuggestion,
    cancelCorrectSuggestions,
    openFindReplaceForCorrectSelection,
  };
}
