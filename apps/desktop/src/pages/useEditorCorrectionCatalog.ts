import { useCallback, useEffect, useState } from "react";
import { correctionStableRulesList } from "../tauri/correctionApi";
import { glossaryList, type GlossaryTermDto } from "../tauri/glossaryApi";
import type { CorrectionRuleRow } from "../tauri/correctionApi";
import {
  correctSuggestionsForSurface,
  findCorrectableSpans,
  type CorrectableSpan,
} from "../services/editor/findCorrectableSpans";

type Args = {
  enabled: boolean;
};

export function useEditorCorrectionCatalog({ enabled }: Args) {
  const [rules, setRules] = useState<CorrectionRuleRow[]>([]);
  const [glossary, setGlossary] = useState<GlossaryTermDto[]>([]);
  const [loadError, setLoadError] = useState("");

  const refresh = useCallback(async () => {
    if (!enabled) {
      setRules([]);
      setGlossary([]);
      return;
    }
    setLoadError("");
    try {
      const [nextRules, nextGlossary] = await Promise.all([correctionStableRulesList(), glossaryList()]);
      setRules(nextRules);
      setGlossary(nextGlossary);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const spansForText = useCallback(
    (text: string): CorrectableSpan[] => findCorrectableSpans(text, rules),
    [rules],
  );

  const suggestionsForSurface = useCallback(
    (surface: string) => correctSuggestionsForSurface(surface, rules, glossary),
    [glossary, rules],
  );

  return {
    rules,
    glossary,
    loadError,
    refresh,
    spansForText,
    suggestionsForSurface,
    catalogReady: rules.length > 0,
  };
}
