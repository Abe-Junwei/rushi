import { useCallback, useState } from "react";
import { correctionGlossaryLearnPrompts, type GlossaryLearnPromptRow } from "../tauri/correctionApi";
import { glossaryAdd } from "../tauri/glossaryApi";
import { dismissGlossaryPrompt, filterUndismissedPrompts } from "../utils/glossaryPromptDismiss";
import { toast } from "../services/ui/toast";

export type GlossaryLearnPromptDialogState =
  | { phase: "closed" }
  | { phase: "prompt"; rows: GlossaryLearnPromptRow[] };

type Args = {
  setError: (msg: string) => void;
};

export function useGlossaryLearnPromptController({ setError }: Args) {
  const [dialog, setDialog] = useState<GlossaryLearnPromptDialogState>({ phase: "closed" });

  const checkAfterSave = useCallback(async () => {
    try {
      const rows = filterUndismissedPrompts(await correctionGlossaryLearnPrompts());
      if (!rows.length) return;
      setDialog({ phase: "prompt", rows });
    } catch {
      // non-blocking
    }
  }, []);

  const dismissGlossaryLearnPrompt = useCallback((row: GlossaryLearnPromptRow) => {
    dismissGlossaryPrompt(row.afterText);
    setDialog((prev) => {
      if (prev.phase !== "prompt") return prev;
      const rows = prev.rows.filter((r) => r.afterText !== row.afterText);
      return rows.length ? { phase: "prompt", rows } : { phase: "closed" };
    });
  }, []);

  const confirmAddToGlossary = useCallback(
    async (row: GlossaryLearnPromptRow) => {
      setError("");
      try {
        await glossaryAdd({
          term: row.afterText,
          aliases: row.sampleBefore && row.sampleBefore !== row.afterText ? row.sampleBefore : "",
          domain: "",
          note: `手改记忆 ${row.hitCount} 次`,
          hotwordEnabled: true,
        });
        dismissGlossaryPrompt(row.afterText);
        toast.success(`已将「${row.afterText}」加入术语表`);
        setDialog((prev) => {
          if (prev.phase !== "prompt") return prev;
          const rows = prev.rows.filter((r) => r.afterText !== row.afterText);
          return rows.length ? { phase: "prompt", rows } : { phase: "closed" };
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [setError],
  );

  const closeGlossaryLearnPrompt = useCallback(() => {
    setDialog({ phase: "closed" });
  }, []);

  return {
    glossaryLearnDialog: dialog,
    checkGlossaryLearnAfterSave: checkAfterSave,
    dismissGlossaryLearnPrompt,
    confirmAddToGlossary,
    closeGlossaryLearnPrompt,
  };
}
