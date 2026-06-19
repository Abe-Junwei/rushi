import { readStorage, writeStorage } from "../stt/sttOnlineProviderContract/storage";
import {
  getLlmProviderDefinition,
  isLocalLoopbackLlmProvider,
  LEGACY_POSTPROCESS_STORAGE_KEYS,
  LLM_CONNECTION_VERIFIED_EVENT,
  LLM_STORAGE_KEYS,
  normalizeLlmApiKeyId,
  OLLAMA_LOOPBACK_PLACEHOLDER_API_KEY,
  type LlmProviderId,
} from "./llmProviderCatalog";
import {
  readLlmPromptOverridesFromStorage,
  hasLlmPromptOverrides,
  type LlmPromptDefaults,
  type LlmPromptOverrides,
} from "./llmPromptStorage";

export type { LlmPromptDefaults, LlmPromptOverrides };
export {
  clearLlmPromptOverrides,
  persistLlmPromptOverrides,
  readLlmPromptOverridesFromStorage,
  resolveEffectiveLlmPromptOverrides,
} from "./llmPromptStorage";

export type LlmRuntimeConfig = {
  providerId: LlmProviderId;
  baseUrl: string;
  model: string;
  apiKeyId?: string;
};

/** 发往 Tauri 后处理命令的运行时桥（camelCase，与 Rust `PostprocessRuntimeBridge` 一致）。 */
export type PostprocessRuntimeBridge = {
  provider: string;
  baseUrl: string;
  model: string;
  apiKey?: string;
  apiKeyId?: string;
  allowInsecureHttp?: boolean;
  promptOverrides?: LlmPromptOverrides;
};

const inMemoryLlmSecrets: { apiKey?: string } = {};

function migrateLegacyLlmStorageKeys(): void {
  const hasNew = readStorage(LLM_STORAGE_KEYS.providerId);
  if (hasNew) return;
  const legacyId = readStorage(LEGACY_POSTPROCESS_STORAGE_KEYS.providerId);
  if (!legacyId) return;
  writeStorage(LLM_STORAGE_KEYS.providerId, legacyId);
  const legacyUrl = readStorage(LEGACY_POSTPROCESS_STORAGE_KEYS.baseUrl);
  if (legacyUrl) writeStorage(LLM_STORAGE_KEYS.baseUrl, legacyUrl);
  const legacyModel = readStorage(LEGACY_POSTPROCESS_STORAGE_KEYS.model);
  if (legacyModel) writeStorage(LLM_STORAGE_KEYS.model, legacyModel);
}

export function isLocalLoopbackLlmConfig(
  config: Pick<LlmRuntimeConfig, "providerId" | "baseUrl"> = readLlmRuntimeConfigFromStorage(),
): boolean {
  if (isLocalLoopbackLlmProvider(config.providerId)) return true;
  const base = config.baseUrl.trim();
  return base.startsWith("http://127.0.0.1") || base.startsWith("http://localhost");
}

export function readLlmRuntimeConfigFromStorage(): LlmRuntimeConfig {
  migrateLegacyLlmStorageKeys();
  const rawId = (readStorage(LLM_STORAGE_KEYS.providerId) ?? "deepseek").trim();
  const providerId: LlmProviderId = getLlmProviderDefinition(rawId)?.id ?? "deepseek";
  const def = getLlmProviderDefinition(providerId)!;
  const baseUrl = (readStorage(LLM_STORAGE_KEYS.baseUrl) ?? def.defaultBaseUrl).trim();
  const model = (readStorage(LLM_STORAGE_KEYS.model) ?? def.defaultModel).trim();
  const rawApiKeyId = (readStorage(LLM_STORAGE_KEYS.apiKeyId) ?? "").trim();
  const apiKeyId = normalizeLlmApiKeyId(rawApiKeyId);
  if (rawApiKeyId && apiKeyId && rawApiKeyId !== apiKeyId) {
    writeStorage(LLM_STORAGE_KEYS.apiKeyId, apiKeyId);
  } else if (rawApiKeyId && !apiKeyId) {
    localStorage.removeItem(LLM_STORAGE_KEYS.apiKeyId);
  }
  return { providerId, baseUrl, model, apiKeyId };
}

export function llmRuntimeConnectionFingerprint(config: LlmRuntimeConfig = readLlmRuntimeConfigFromStorage()): string {
  return [config.providerId, config.baseUrl, config.model, config.apiKeyId ?? ""].join("\0");
}

export function markLlmConnectionVerified(config: LlmRuntimeConfig = readLlmRuntimeConfigFromStorage()): void {
  writeStorage(LLM_STORAGE_KEYS.connectionVerifiedFingerprint, llmRuntimeConnectionFingerprint(config));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(LLM_CONNECTION_VERIFIED_EVENT));
  }
}

export function clearLlmConnectionVerified(): void {
  localStorage.removeItem(LLM_STORAGE_KEYS.connectionVerifiedFingerprint);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(LLM_CONNECTION_VERIFIED_EVENT));
  }
}

export function isLlmConnectionVerified(config: LlmRuntimeConfig = readLlmRuntimeConfigFromStorage()): boolean {
  const stored = readStorage(LLM_STORAGE_KEYS.connectionVerifiedFingerprint);
  if (!stored) return false;
  return stored === llmRuntimeConnectionFingerprint(config);
}

export type PersistLlmRuntimeConfigOptions = {
  /** 显式清除钥匙串引用（清除已保存 API Key 时使用） */
  clearApiKeyId?: boolean;
};

export function validateLlmConnectionDraft(config: Pick<LlmRuntimeConfig, "providerId" | "baseUrl" | "model">): void {
  const def = getLlmProviderDefinition(config.providerId);
  if (!def) throw new Error("未知的 LLM 厂商预设。");
  const baseUrl = config.baseUrl.trim() || def.defaultBaseUrl;
  const model = config.model.trim() || def.defaultModel;
  if (
    !baseUrl.startsWith("https://") &&
    !baseUrl.startsWith("http://127.0.0.1") &&
    !baseUrl.startsWith("http://localhost")
  ) {
    throw new Error("API 基址须为 https://，或本机 http://127.0.0.1 / localhost（开发）。");
  }
  if (!model) {
    throw new Error("请填写模型 ID。");
  }
}

function writeLastCloudRuntimeSnapshot(config: LlmRuntimeConfig): void {
  if (isLocalLoopbackLlmProvider(config.providerId)) return;
  const def = getLlmProviderDefinition(config.providerId)!;
  const baseUrl = config.baseUrl.trim() || def.defaultBaseUrl;
  const model = config.model.trim() || def.defaultModel;
  writeStorage(LLM_STORAGE_KEYS.lastCloudProviderId, config.providerId);
  writeStorage(LLM_STORAGE_KEYS.lastCloudBaseUrl, baseUrl);
  writeStorage(LLM_STORAGE_KEYS.lastCloudModel, model);
  const apiKeyId = normalizeLlmApiKeyId(config.apiKeyId?.trim());
  if (apiKeyId) writeStorage(LLM_STORAGE_KEYS.lastCloudApiKeyId, apiKeyId);
  else localStorage.removeItem(LLM_STORAGE_KEYS.lastCloudApiKeyId);
}

/** 切到本机前快照当前云端配置，便于再次切回云端时恢复。 */
export function snapshotLastCloudRuntimeFromStorage(): void {
  const current = readLlmRuntimeConfigFromStorage();
  if (!isLocalLoopbackLlmProvider(current.providerId)) {
    writeLastCloudRuntimeSnapshot(current);
  }
}

/** 读取上次云端配置；无快照时回退 DeepSeek 预设。 */
export function readLastCloudRuntimeConfig(): LlmRuntimeConfig {
  const rawId = (readStorage(LLM_STORAGE_KEYS.lastCloudProviderId) ?? "").trim();
  const providerId: LlmProviderId = getLlmProviderDefinition(rawId)?.id ?? "deepseek";
  const def = getLlmProviderDefinition(providerId)!;
  const baseUrl = (readStorage(LLM_STORAGE_KEYS.lastCloudBaseUrl) ?? def.defaultBaseUrl).trim();
  const model = (readStorage(LLM_STORAGE_KEYS.lastCloudModel) ?? def.defaultModel).trim();
  const apiKeyId = normalizeLlmApiKeyId(readStorage(LLM_STORAGE_KEYS.lastCloudApiKeyId) ?? undefined);
  return { providerId, baseUrl, model, apiKeyId };
}

export function persistLlmRuntimeConfig(
  config: LlmRuntimeConfig,
  options?: PersistLlmRuntimeConfigOptions,
): void {
  validateLlmConnectionDraft(config);
  const def = getLlmProviderDefinition(config.providerId)!;
  const baseUrl = config.baseUrl.trim() || def.defaultBaseUrl;
  const model = config.model.trim() || def.defaultModel;
  const previous = readLlmRuntimeConfigFromStorage();
  const previousFingerprint = llmRuntimeConnectionFingerprint(previous);

  let nextApiKeyId = previous.apiKeyId;
  if (options?.clearApiKeyId) {
    nextApiKeyId = undefined;
  } else if (config.apiKeyId?.trim()) {
    const normalized = normalizeLlmApiKeyId(config.apiKeyId);
    nextApiKeyId = normalized ?? undefined;
  }

  const nextConfig: LlmRuntimeConfig = {
    providerId: config.providerId,
    baseUrl,
    model,
    apiKeyId: nextApiKeyId,
  };
  const nextFingerprint = llmRuntimeConnectionFingerprint(nextConfig);

  writeStorage(LLM_STORAGE_KEYS.providerId, config.providerId);
  writeStorage(LLM_STORAGE_KEYS.baseUrl, baseUrl);
  writeStorage(LLM_STORAGE_KEYS.model, model);
  if (options?.clearApiKeyId) {
    localStorage.removeItem(LLM_STORAGE_KEYS.apiKeyId);
  } else if (config.apiKeyId?.trim()) {
    const normalized = normalizeLlmApiKeyId(config.apiKeyId);
    if (normalized) writeStorage(LLM_STORAGE_KEYS.apiKeyId, normalized);
    else localStorage.removeItem(LLM_STORAGE_KEYS.apiKeyId);
  }
  if (!isLocalLoopbackLlmProvider(config.providerId)) {
    writeLastCloudRuntimeSnapshot(nextConfig);
  }
  if (previousFingerprint !== nextFingerprint) {
    clearLlmConnectionVerified();
  }
}

export function applyLlmProviderPreset(providerId: LlmProviderId): LlmRuntimeConfig {
  const def = getLlmProviderDefinition(providerId)!;
  return { providerId, baseUrl: def.defaultBaseUrl, model: def.defaultModel };
}

export function setLlmApiKeyInMemory(apiKey: string | null | undefined): void {
  const t = apiKey?.trim();
  if (t) inMemoryLlmSecrets.apiKey = t;
  else delete inMemoryLlmSecrets.apiKey;
}

export function getLlmApiKeyFromMemory(): string | undefined {
  return inMemoryLlmSecrets.apiKey;
}

export function isLlmRuntimeReady(): boolean {
  const cfg = readLlmRuntimeConfigFromStorage();
  if (!cfg.baseUrl?.trim() || !cfg.model?.trim()) return false;
  if (isLocalLoopbackLlmConfig(cfg)) return true;
  return Boolean(getLlmApiKeyFromMemory()?.trim() || cfg.apiKeyId?.trim());
}

export function tryBuildPostprocessRuntimeBridge(): PostprocessRuntimeBridge | null {
  const cfg = readLlmRuntimeConfigFromStorage();
  const def = getLlmProviderDefinition(cfg.providerId);
  if (!def) return null;
  const base = cfg.baseUrl.trim() || def.defaultBaseUrl;
  const allowInsecureHttp =
    base.startsWith("http://127.0.0.1") || base.startsWith("http://localhost");
  const loopback = isLocalLoopbackLlmConfig(cfg);
  const apiKey = getLlmApiKeyFromMemory()?.trim();
  const apiKeyId = normalizeLlmApiKeyId(cfg.apiKeyId?.trim());
  if (!loopback && !apiKey && !apiKeyId) return null;
  const runtime: PostprocessRuntimeBridge = {
    provider: def.label,
    baseUrl: base,
    model: cfg.model.trim() || def.defaultModel,
    allowInsecureHttp: allowInsecureHttp || undefined,
  };
  if (loopback) {
    runtime.apiKey = OLLAMA_LOOPBACK_PLACEHOLDER_API_KEY;
  } else if (apiKey) {
    runtime.apiKey = apiKey;
  } else if (apiKeyId) {
    runtime.apiKeyId = apiKeyId;
  }
  const promptOverrides = readLlmPromptOverridesFromStorage();
  if (hasLlmPromptOverrides(promptOverrides)) {
    runtime.promptOverrides = promptOverrides;
  }
  return runtime;
}

import { ENV_NAV } from "../../config/environmentNavCopy";

export function llmConfigHint(): string {
  const cfg = readLlmRuntimeConfigFromStorage();
  if (isLocalLoopbackLlmConfig(cfg)) {
    return `请在「${ENV_NAV.llm}」确认 Ollama 已启动并保存模型。`;
  }
  return `请在「${ENV_NAV.llm}」选择厂商并保存 API Key。`;
}

export { resolveStageBBlockReason } from "./llmRuntimeBlockReasons";
