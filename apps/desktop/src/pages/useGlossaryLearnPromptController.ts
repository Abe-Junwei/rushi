import { useCallback, useState } from "react";
import { correctionGlossaryLearnPrompts, type GlossaryLearnPromptRow } from "../tauri/correctionApi";
import { glossaryAdd } from "../tauri/glossaryApi";
import { dismissGlossaryPrompt, filterUndismissedPrompts } from "../utils/glossaryPromptDismiss";
import { toast } from "../services/ui/toast";
import { filterGlossaryLearnPromptsForFocus } from "./glossaryLearnPromptFocus";

export type GlossaryLearnPromptDialogState =
  | { phase: "closed" }
  | { phase: "prompt"; rows: GlossaryLearnPromptRow[] };

type Args = {
  setError: (msg: string) => void;
};

export function useGlossaryLearnPromptController({ setError }: Args) {
  const [dialog, setDialog] = useState<GlossaryLearnPromptDialogState>({ phase: "closed" });

  /** 仅「纳入更正记忆」后调用；只提示本次正形是否刚达 hit≥阈值，不扫全局 backlog。 */
  const checkAfterManualLearn = useCallback(async (focusAfterTexts: readonly string[]) => {
    try {
      const rows = filterGlossaryLearnPromptsForFocus(
        filterUndismissedPrompts(await correctionGlossaryLearnPrompts()),
        focusAfterTexts,
      );
      if (!rows.length) return;
      setDialog({ phase: "prompt", rows });
    } catch {
      // non-blocking
    }
  }, []);

  const removePromptRow = useCallback((afterText: string) => {
    dismissGlossaryPrompt(afterText);
    setDialog((prev) => {
      if (prev.phase !== "prompt") return prev;
      const rows = prev.rows.filter((r) => r.afterText !== afterText);
      return rows.length ? { phase: "prompt", rows } : { phase: "closed" };
    });
  }, []);

  const dismissGlossaryLearnPrompt = useCallback(
    (row: GlossaryLearnPromptRow) => {
      removePromptRow(row.afterText);
    },
    [removePromptRow],
  );
  const confirmAddToGlossary = useCallback(
    async (row: GlossaryLearnPromptRow) => {
      setError("");
      try {
        // 仅写入正形；错形（sampleBefore）禁止作 alias，否则 hotword_guard 会拒写。
        await glossaryAdd({
          term: row.afterText,
          aliases: "",
          domain: "",
          note: `手改记忆 ${row.hitCount} 次${
            row.sampleBefore && row.sampleBefore !== row.afterText
              ? ` · 例 ${row.sampleBefore}→${row.afterText}`
              : ""
          }`,
          hotwordEnabled: true,
        });
        removePromptRow(row.afterText);
        toast.success(`已将「${row.afterText}」加入术语表`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("已存在")) {
          removePromptRow(row.afterText);
          toast.success(`「${row.afterText}」已在术语表中`);
          return;
        }
        setError(msg);
      }
    },
    [removePromptRow, setError],
  );

  const closeGlossaryLearnPrompt = useCallback(() => {
    setDialog({ phase: "closed" });
  }, []);

  return {
    glossaryLearnDialog: dialog,
    checkGlossaryLearnAfterSave: checkAfterManualLearn,
    dismissGlossaryLearnPrompt,
    confirmAddToGlossary,
    closeGlossaryLearnPrompt,
  };
}
