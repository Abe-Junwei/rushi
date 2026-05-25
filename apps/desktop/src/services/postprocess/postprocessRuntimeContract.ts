import { readStorage, writeStorage } from "../stt/sttOnlineProviderContract/storage";

/** 当前持久化键（LLM 配置真源） */
export const LLM_STORAGE_KEYS = {
  providerId: "rushi.llm.providerId",
  baseUrl: "rushi.llm.baseUrl",
  model: "rushi.llm.model",
  apiKeyId: "rushi.llm.apiKeyId",
} as const;

/** @deprecated 仅用于从旧版「自动标点」页迁移 */
const LEGACY_POSTPROCESS_STORAGE_KEYS = {
  providerId: "rushi.postprocess.providerId",
  baseUrl: "rushi.postprocess.baseUrl",
  model: "rushi.postprocess.model",
} as const;

export type LlmProviderId =
  | "deepseek"
  | "kimi"
  | "qwen"
  | "siliconflow"
  | "doubao"
  | "openai"
  | "openrouter";

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
  {
    id: "qwen",
    label: "通义千问（阿里百炼）",
    description: "阿里云百炼 OpenAI 兼容接口；适合中文通用任务，可直接切换 Qwen 系列模型。",
    docsUrl: "https://help.aliyun.com/zh/model-studio/compatibility-of-openai-with-dashscope",
    defaultBaseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    defaultModel: "qwen-plus",
    modelExamples: ["qwen-plus", "qwen-turbo", "qwen-max"],
  },
  {
    id: "siliconflow",
    label: "SiliconFlow",
    description: "硅基流动 OpenAI 兼容接口；国内开发者常用，适合按模型族灵活切换。",
    docsUrl: "https://docs.siliconflow.com/en/api-reference/chat-completions/chat-completions",
    defaultBaseUrl: "https://api.siliconflow.com/v1",
    defaultModel: "Qwen/Qwen3-8B",
    modelExamples: ["Qwen/Qwen3-8B", "deepseek-ai/DeepSeek-V3", "deepseek-ai/DeepSeek-R1"],
  },
  {
    id: "doubao",
    label: "火山方舟（Doubao）",
    description: "火山引擎方舟 OpenAI 兼容入口；`model` 通常填写你在方舟控制台创建的 endpoint ID。",
    docsUrl: "https://console.volcengine.com/ark",
    defaultBaseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    defaultModel: "ep-your-endpoint-id",
    modelExamples: ["ep-your-endpoint-id", "ep-20260525-example", "ep-prod-doubao"],
  },
  {
    id: "openai",
    label: "OpenAI",
    description: "国际通用参考实现；适合作为兼容基线或海外直连备选。",
    docsUrl: "https://platform.openai.com/docs/api-reference/chat",
    defaultBaseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    modelExamples: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini"],
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    description: "统一聚合多家海外模型的 OpenAI 兼容入口；适合兼顾国外模型覆盖面。",
    docsUrl: "https://openrouter.ai/docs/quickstart",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "~openai/gpt-latest",
    modelExamples: ["~openai/gpt-latest", "openai/gpt-4o-mini", "anthropic/claude-3.5-sonnet"],
  },
];

export type LlmRuntimeConfig = {
  providerId: LlmProviderId;
  baseUrl: string;
  model: string;
  apiKeyId?: string;
};

/** 发往 Tauri 后处理命令的运行时桥（字段名与 Rust 一致）。 */
export type PostprocessRuntimeBridge = {
  provider: string;
  base_url: string;
  model: string;
  api_key?: string;
  api_key_id?: string;
  allow_insecure_http?: boolean;
};

const inMemoryLlmSecrets: { apiKey?: string } = {};
export const DEFAULT_LLM_API_KEY_ID = "default";

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
  const providerId: LlmProviderId = getLlmProviderDefinition(rawId)?.id ?? "deepseek";
  const def = getLlmProviderDefinition(providerId)!;
  const baseUrl = (readStorage(LLM_STORAGE_KEYS.baseUrl) ?? def.defaultBaseUrl).trim();
  const model = (readStorage(LLM_STORAGE_KEYS.model) ?? def.defaultModel).trim();
  const apiKeyId = (readStorage(LLM_STORAGE_KEYS.apiKeyId) ?? "").trim() || undefined;
  return { providerId, baseUrl, model, apiKeyId };
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
  if (config.apiKeyId?.trim()) {
    writeStorage(LLM_STORAGE_KEYS.apiKeyId, config.apiKeyId.trim());
  } else {
    localStorage.removeItem(LLM_STORAGE_KEYS.apiKeyId);
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
  if (!cfg.baseUrl || !cfg.model) return false;
  return Boolean(getLlmApiKeyFromMemory()?.trim() || cfg.apiKeyId?.trim());
}

export function tryBuildPostprocessRuntimeBridge(): PostprocessRuntimeBridge | null {
  const cfg = readLlmRuntimeConfigFromStorage();
  const def = getLlmProviderDefinition(cfg.providerId);
  const apiKey = getLlmApiKeyFromMemory()?.trim();
  const apiKeyId = cfg.apiKeyId?.trim();
  if (!def || (!apiKey && !apiKeyId)) return null;
  const base = cfg.baseUrl.trim() || def.defaultBaseUrl;
  const allow_insecure_http =
    base.startsWith("http://127.0.0.1") || base.startsWith("http://localhost");
  const runtime: PostprocessRuntimeBridge = {
    provider: def.label,
    base_url: base,
    model: cfg.model.trim() || def.defaultModel,
    allow_insecure_http: allow_insecure_http || undefined,
  };
  if (apiKey) runtime.api_key = apiKey;
  else if (apiKeyId) runtime.api_key_id = apiKeyId;
  return runtime;
}

export function llmConfigHint(): string {
  return "请打开「设置 → LLM 配置」，选择厂商并保存 API Key 到系统钥匙串。";
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
