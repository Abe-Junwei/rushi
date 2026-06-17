import { readStorage, writeStorage } from "../stt/sttOnlineProviderContract/storage";
import { LLM_STORAGE_KEYS } from "./llmProviderCatalog";

export type LlmPromptOverrides = {
  stageBSystem?: string;
  stageBInstructions?: string;
  autoPunctuateSystem?: string;
  autoPunctuateInstructions?: string;
  exportPolishSystem?: string;
  exportPolishInstructions?: string;
};

export type LlmPromptDefaults = {
  stageBSystem: string;
  stageBInstructions: string;
  autoPunctuateSystem: string;
  autoPunctuateInstructions: string;
  exportPolishSystem: string;
  exportPolishInstructions: string;
};

export type LlmPromptDraft = {
  stageBSystem: string;
  stageBInstructions: string;
  autoPunctuateSystem: string;
  autoPunctuateInstructions: string;
  exportPolishSystem: string;
  exportPolishInstructions: string;
};

const OVERRIDE_FIELDS = [
  ["stageBSystem", LLM_STORAGE_KEYS.promptStageBSystem],
  ["stageBInstructions", LLM_STORAGE_KEYS.promptStageBInstructions],
  ["autoPunctuateSystem", LLM_STORAGE_KEYS.promptAutoPunctuateSystem],
  ["autoPunctuateInstructions", LLM_STORAGE_KEYS.promptAutoPunctuateInstructions],
  ["exportPolishSystem", LLM_STORAGE_KEYS.promptExportPolishSystem],
  ["exportPolishInstructions", LLM_STORAGE_KEYS.promptExportPolishInstructions],
] as const satisfies ReadonlyArray<readonly [keyof LlmPromptOverrides, string]>;

function trimOrUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

const EXPORT_POLISH_TEMPLATE_REQUIRED_PLACEHOLDERS = [
  "{line_count}",
  "{batch_note}",
  "{rule_hints}",
  "{body}",
] as const;

export function validateLlmPromptOverrides(overrides: LlmPromptOverrides): void {
  const template = trimOrUndefined(overrides.exportPolishInstructions);
  if (!template) return;
  const missing = EXPORT_POLISH_TEMPLATE_REQUIRED_PLACEHOLDERS.filter(
    (placeholder) => !template.includes(placeholder),
  );
  if (missing.length > 0) {
    throw new Error(`导出润色 User 指令缺少占位符：${missing.join("、")}。`);
  }
}

export function readLlmPromptOverridesFromStorage(): LlmPromptOverrides {
  const out: LlmPromptOverrides = {};
  for (const [field, key] of OVERRIDE_FIELDS) {
    const value = trimOrUndefined(readStorage(key) ?? undefined);
    if (value) out[field] = value;
  }
  return out;
}

export function persistLlmPromptOverrides(overrides: LlmPromptOverrides): void {
  validateLlmPromptOverrides(overrides);
  for (const [field, key] of OVERRIDE_FIELDS) {
    const value = trimOrUndefined(overrides[field]);
    if (value) writeStorage(key, value);
    else localStorage.removeItem(key);
  }
}

export function clearLlmPromptOverrides(): void {
  for (const [, key] of OVERRIDE_FIELDS) {
    localStorage.removeItem(key);
  }
}

export function hasLlmPromptOverrides(overrides: LlmPromptOverrides): boolean {
  return OVERRIDE_FIELDS.some(([field]) => Boolean(trimOrUndefined(overrides[field])));
}

/** 与 Rust 默认一致时视为未覆盖，避免冗余写入 runtime bridge。 */
export function resolveEffectiveLlmPromptOverrides(
  draft: LlmPromptOverrides,
  defaults: LlmPromptDefaults,
): LlmPromptOverrides | undefined {
  const out: LlmPromptOverrides = {};
  for (const [field] of OVERRIDE_FIELDS) {
    const draftValue = trimOrUndefined(draft[field]);
    const defaultValue = defaults[field].trim();
    if (draftValue && draftValue !== defaultValue) {
      out[field] = draftValue;
    }
  }
  return hasLlmPromptOverrides(out) ? out : undefined;
}

export function mergePromptDraftWithDefaults(
  draft: LlmPromptOverrides,
  defaults: LlmPromptDefaults,
): LlmPromptDraft {
  return {
    stageBSystem: draft.stageBSystem?.trim() || defaults.stageBSystem,
    stageBInstructions: draft.stageBInstructions?.trim() || defaults.stageBInstructions,
    autoPunctuateSystem: draft.autoPunctuateSystem?.trim() || defaults.autoPunctuateSystem,
    autoPunctuateInstructions:
      draft.autoPunctuateInstructions?.trim() || defaults.autoPunctuateInstructions,
    exportPolishSystem: draft.exportPolishSystem?.trim() || defaults.exportPolishSystem,
    exportPolishInstructions:
      draft.exportPolishInstructions?.trim() || defaults.exportPolishInstructions,
  };
}

export function draftFromMergedPrompt(merged: LlmPromptDraft): LlmPromptOverrides {
  return { ...merged };
}

export function buildProfilePromptSection(
  overrides: LlmPromptOverrides,
): SettingsProfilePromptSection | undefined {
  if (!hasLlmPromptOverrides(overrides)) return undefined;
  return {
    ...(overrides.stageBSystem ? { stage_b_system: overrides.stageBSystem } : {}),
    ...(overrides.stageBInstructions ? { stage_b_instructions: overrides.stageBInstructions } : {}),
    ...(overrides.autoPunctuateSystem ? { auto_punctuate_system: overrides.autoPunctuateSystem } : {}),
    ...(overrides.autoPunctuateInstructions
      ? { auto_punctuate_instructions: overrides.autoPunctuateInstructions }
      : {}),
    ...(overrides.exportPolishSystem ? { export_polish_system: overrides.exportPolishSystem } : {}),
    ...(overrides.exportPolishInstructions
      ? { export_polish_instructions: overrides.exportPolishInstructions }
      : {}),
  };
}

export type SettingsProfilePromptSection = {
  stage_b_system?: string;
  stage_b_instructions?: string;
  auto_punctuate_system?: string;
  auto_punctuate_instructions?: string;
  export_polish_system?: string;
  export_polish_instructions?: string;
};

export function profilePromptSectionToOverrides(
  prompt: SettingsProfilePromptSection,
): LlmPromptOverrides {
  return {
    stageBSystem: prompt.stage_b_system,
    stageBInstructions: prompt.stage_b_instructions,
    autoPunctuateSystem: prompt.auto_punctuate_system,
    autoPunctuateInstructions: prompt.auto_punctuate_instructions,
    exportPolishSystem: prompt.export_polish_system,
    exportPolishInstructions: prompt.export_polish_instructions,
  };
}
