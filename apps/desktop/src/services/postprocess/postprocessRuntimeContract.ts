import { readStorage, writeStorage } from "../stt/sttOnlineProviderContract/storage";

/** 当前持久化键（LLM 配置真源） */
export const LLM_STORAGE_KEYS = {
  providerId: "rushi.llm.providerId",
  baseUrl: "rushi.llm.baseUrl",
  model: "rushi.llm.model",
} as const;

/** @deprecated 仅用于从旧版「自动标点」页迁移 */
const LEGACY_POSTPROCESS_STORAGE_KEYS = {
  providerId: "rushi.postprocess.providerId",
  baseUrl: "rushi.postprocess.baseUrl",
  model: "rushi.postprocess.model",
} as const;

export type LlmProviderId = "deepseek" | "kimi";

export type LlmProviderDefinition = {
  id: LlmProviderId;
  label: string;
  description: string;
  docsUrl: string;
  defaultBaseUrl: string;
  defaultModel: string;
  modelExamples: string[];
};

export type LlmCapability = {
  id: "auto_punctuate";
  label: string;
  description: string;
};

/** 共用本页 LLM 连接的能力清单（随功能迭代扩展）。 */
export const LLM_CAPABILITIES: LlmCapability[] = [
  {
    id: "auto_punctuate",
    label: "自动标点",
    description: "编辑器语段工具栏：为单条中文正文补充标点，预览 diff 后确认写回。",
  },
];

export const LLM_PROVIDER_DEFINITIONS: LlmProviderDefinition[] = [
  {
    id: "deepseek",
    label: "DeepSeek",
    description: "深度求索 OpenAI 兼容 API，适合中文标点与通用文本任务。",
    docsUrl: "https://platform.deepseek.com/api-docs/",
    defaultBaseUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
    modelExamples: ["deepseek-chat", "deepseek-reasoner"],
  },
  {
    id: "kimi",
    label: "Kimi（Moonshot）",
    description: "月之暗面 Moonshot 开放平台；Kimi 系列模型同一兼容端点。",
    docsUrl: "https://platform.moonshot.cn/docs/api/chat",
    defaultBaseUrl: "https://api.moonshot.cn/v1",
    defaultModel: "moonshot-v1-8k",
    modelExamples: ["moonshot-v1-8k", "moonshot-v1-32k", "kimi-k2-0711-preview"],
  },
];

export type LlmRuntimeConfig = {
  providerId: LlmProviderId;
  baseUrl: string;
  model: string;
};

/** 发往 Tauri 后处理命令的运行时桥（字段名与 Rust 一致）。 */
export type PostprocessRuntimeBridge = {
  provider: string;
  base_url: string;
  model: string;
  api_key: string;
  allow_insecure_http?: boolean;
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

export function getLlmProviderDefinition(id: string): LlmProviderDefinition | undefined {
  return LLM_PROVIDER_DEFINITIONS.find((d) => d.id === id);
}

export function readLlmRuntimeConfigFromStorage(): LlmRuntimeConfig {
  migrateLegacyLlmStorageKeys();
  const rawId = (readStorage(LLM_STORAGE_KEYS.providerId) ?? "deepseek").trim();
  const providerId: LlmProviderId = rawId === "kimi" ? "kimi" : "deepseek";
  const def = getLlmProviderDefinition(providerId)!;
  const baseUrl = (readStorage(LLM_STORAGE_KEYS.baseUrl) ?? def.defaultBaseUrl).trim();
  const model = (readStorage(LLM_STORAGE_KEYS.model) ?? def.defaultModel).trim();
  return { providerId, baseUrl, model };
}

export function persistLlmRuntimeConfig(config: LlmRuntimeConfig): void {
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
  writeStorage(LLM_STORAGE_KEYS.providerId, config.providerId);
  writeStorage(LLM_STORAGE_KEYS.baseUrl, baseUrl);
  writeStorage(LLM_STORAGE_KEYS.model, model);
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
  if (!cfg.baseUrl || !cfg.model) return false;
  return Boolean(getLlmApiKeyFromMemory()?.trim());
}

export function tryBuildPostprocessRuntimeBridge(): PostprocessRuntimeBridge | null {
  const cfg = readLlmRuntimeConfigFromStorage();
  const def = getLlmProviderDefinition(cfg.providerId);
  const apiKey = getLlmApiKeyFromMemory()?.trim();
  if (!def || !apiKey) return null;
  const base = cfg.baseUrl.trim() || def.defaultBaseUrl;
  const allow_insecure_http =
    base.startsWith("http://127.0.0.1") || base.startsWith("http://localhost");
  return {
    provider: def.label,
    base_url: base,
    model: cfg.model.trim() || def.defaultModel,
    api_key: apiKey,
    allow_insecure_http: allow_insecure_http || undefined,
  };
}

export function llmConfigHint(): string {
  return "请打开「设置 → LLM 配置」，选择厂商并保存 API Key。";
}

// --- 兼容旧命名（内部调用逐步迁移） ---
export type PostprocessProviderId = LlmProviderId;
export const POSTPROCESS_PROVIDER_DEFINITIONS = LLM_PROVIDER_DEFINITIONS;
export const POSTPROCESS_STORAGE_KEYS = LLM_STORAGE_KEYS;
export type PostprocessRuntimeConfig = LlmRuntimeConfig;
export const getPostprocessProviderDefinition = getLlmProviderDefinition;
export const readPostprocessRuntimeConfigFromStorage = readLlmRuntimeConfigFromStorage;
export const persistPostprocessRuntimeConfig = persistLlmRuntimeConfig;
export const applyPostprocessProviderPreset = applyLlmProviderPreset;
export const setPostprocessApiKeyInMemory = setLlmApiKeyInMemory;
export const getPostprocessApiKeyFromMemory = getLlmApiKeyFromMemory;
export const isPostprocessRuntimeReady = isLlmRuntimeReady;
export const postprocessConfigHint = llmConfigHint;
