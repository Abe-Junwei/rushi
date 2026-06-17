import { useCallback, useEffect, useMemo, useState } from "react";
import { getLlmPromptDefaults } from "../tauri/postprocessApi";
import {
  clearLlmPromptOverrides,
  draftFromMergedPrompt,
  mergePromptDraftWithDefaults,
  persistLlmPromptOverrides,
  readLlmPromptOverridesFromStorage,
  resolveEffectiveLlmPromptOverrides,
  type LlmPromptDefaults,
  type LlmPromptDraft,
} from "../services/postprocess/postprocessRuntimeContract";

const EMPTY_DRAFT: LlmPromptDraft = {
  stageBSystem: "",
  stageBInstructions: "",
  autoPunctuateSystem: "",
  autoPunctuateInstructions: "",
  exportPolishSystem: "",
  exportPolishInstructions: "",
};

export function useEnvLlmPromptConfig() {
  const [defaults, setDefaults] = useState<LlmPromptDefaults | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<LlmPromptDraft>(EMPTY_DRAFT);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const nextDefaults = await getLlmPromptDefaults();
        if (cancelled) return;
        setDefaults(nextDefaults);
        const stored = readLlmPromptOverridesFromStorage();
        setDraft(mergePromptDraftWithDefaults(stored, nextDefaults));
        setLoadError(null);
      } catch (e) {
        if (cancelled) return;
        setLoadError(e instanceof Error ? e.message : "无法加载默认提示词。");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setField = useCallback(<K extends keyof LlmPromptDraft>(key: K, value: LlmPromptDraft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }, []);

  const isCustomized = useMemo(() => {
    if (!defaults) return false;
    return Boolean(resolveEffectiveLlmPromptOverrides(draftFromMergedPrompt(draft), defaults));
  }, [defaults, draft]);

  const resetToDefaults = useCallback(() => {
    if (!defaults) return;
    setDraft(mergePromptDraftWithDefaults({}, defaults));
  }, [defaults]);

  const persistDraft = useCallback(() => {
    const overrides = draftFromMergedPrompt(draft);
    if (!defaults) {
      persistLlmPromptOverrides(overrides);
      return;
    }
    const effective = resolveEffectiveLlmPromptOverrides(overrides, defaults);
    if (effective) persistLlmPromptOverrides(effective);
    else clearLlmPromptOverrides();
  }, [defaults, draft]);

  return {
    defaults,
    loadError,
    draft,
    isCustomized,
    setField,
    resetToDefaults,
    persistDraft,
  };
}
