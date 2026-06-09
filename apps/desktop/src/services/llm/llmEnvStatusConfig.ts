import {
  applyLlmProviderPreset,
  getLlmProviderDefinition,
  isLocalLoopbackLlmConfig,
  persistLlmRuntimeConfig,
  readLlmRuntimeConfigFromStorage,
  type LlmRuntimeConfig,
} from "../postprocess/postprocessRuntimeContract";
import type { LlmEnvConfigDraft, LlmEnvMode } from "./llmEnvStatusTypes";

export function readLlmEnvMode(): LlmEnvMode {
  return isLocalLoopbackLlmConfig() ? "local" : "cloud";
}

export function resolveLlmEnvEffectiveConfig(draft?: LlmEnvConfigDraft | null): LlmRuntimeConfig {
  const stored = readLlmRuntimeConfigFromStorage();
  if (!draft) return stored;
  const def = getLlmProviderDefinition(draft.providerId);
  return {
    providerId: draft.providerId,
    baseUrl: (draft.baseUrl.trim() || def?.defaultBaseUrl || stored.baseUrl).trim(),
    model: (draft.model.trim() || def?.defaultModel || stored.model).trim(),
    apiKeyId: stored.apiKeyId,
  };
}

export function llmEnvConfigDraftDirty(draft?: LlmEnvConfigDraft | null): boolean {
  if (!draft) return false;
  const stored = readLlmRuntimeConfigFromStorage();
  const effective = resolveLlmEnvEffectiveConfig(draft);
  return (
    effective.providerId !== stored.providerId ||
    effective.baseUrl !== stored.baseUrl.trim() ||
    effective.model !== stored.model.trim()
  );
}

export function readLlmEnvModeForConfig(cfg: LlmRuntimeConfig): LlmEnvMode {
  return isLocalLoopbackLlmConfig(cfg) ? "local" : "cloud";
}

/** 一键切到本机 Ollama 预设并持久化（无需 API Key）。 */
export function activateLocalOllamaPreset(): void {
  persistLlmRuntimeConfig(applyLlmProviderPreset("ollama"), { clearApiKeyId: true });
}

export function readLlmEnvSnapshot() {
  const cfg = readLlmRuntimeConfigFromStorage();
  return { mode: readLlmEnvMode(), providerId: cfg.providerId };
}
