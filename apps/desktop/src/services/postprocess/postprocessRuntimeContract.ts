import { readStorage, writeStorage } from "../stt/sttOnlineProviderContract/storage";

/** 当前持久化键（LLM 配置真源） */
export const LLM_STORAGE_KEYS = {
  providerId: "rushi.llm.providerId",
  baseUrl: "rushi.llm.baseUrl",
  model: "rushi.llm.model",
  apiKeyId: "rushi.llm.apiKeyId",
  /** 最近一次 chat 路径验证成功的配置指纹（探测或自动标点成功时写入） */
  connectionVerifiedFingerprint: "rushi.llm.connectionVerifiedFingerprint",
} as const;

export const LLM_CONNECTION_VERIFIED_EVENT = "rushi:llm-connection-verified";

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

/** 发往 Tauri 后处理命令的运行时桥（camelCase，与 Rust `PostprocessRuntimeBridge` 一致）。 */
export type PostprocessRuntimeBridge = {
  provider: string;
  baseUrl: string;
  model: string;
  apiKey?: string;
  apiKeyId?: string;
  allowInsecureHttp?: boolean;
};

const inMemoryLlmSecrets: { apiKey?: string } = {};
export const DEFAULT_LLM_API_KEY_ID = "default";

/** apiKeyId 只能是钥匙串条目名（如 default），不能是 API Key 本身（DeepSeek 等为 sk- 开头）。 */
export function isCorruptLlmApiKeyId(raw: string | undefined | null): boolean {
  const id = (raw ?? "").trim();
  if (!id) return false;
  if (id.startsWith("sk-") || id.startsWith("Bearer ")) return true;
  if (id.length > 48) return true;
  return !/^[A-Za-z0-9_-]+$/.test(id);
}

export function normalizeLlmApiKeyId(raw: string | undefined | null): string | undefined {
  const id = (raw ?? "").trim();
  if (!id) return undefined;
  if (isCorruptLlmApiKeyId(id)) return DEFAULT_LLM_API_KEY_ID;
  return id;
}

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

export function persistLlmRuntimeConfig(
  config: LlmRuntimeConfig,
  options?: PersistLlmRuntimeConfigOptions,
): void {
  validateLlmConnectionDraft(config);
  const def = getLlmProviderDefinition(config.providerId)!;
  const baseUrl = config.baseUrl.trim() || def.defaultBaseUrl;
  const model = config.model.trim() || def.defaultModel;
  writeStorage(LLM_STORAGE_KEYS.providerId, config.providerId);
  writeStorage(LLM_STORAGE_KEYS.baseUrl, baseUrl);
  writeStorage(LLM_STORAGE_KEYS.model, model);
  clearLlmConnectionVerified();
  if (options?.clearApiKeyId) {
    localStorage.removeItem(LLM_STORAGE_KEYS.apiKeyId);
  } else if (config.apiKeyId?.trim()) {
    const normalized = normalizeLlmApiKeyId(config.apiKeyId);
    if (normalized) writeStorage(LLM_STORAGE_KEYS.apiKeyId, normalized);
    else localStorage.removeItem(LLM_STORAGE_KEYS.apiKeyId);
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

/** 设置页 / 编辑器共用的连接 UI 状态（不含探测结果以外的「假就绪」）。 */
export type LlmConnectionUiStatus = "missing" | "keychain_missing" | "unverified" | "verified";

export type LlmConnectionUiStatusInput = {
  /** localStorage 有 apiKeyId 或会话内存 Key */
  hasLocalKeyRef: boolean;
  /** 表单中尚未保存的 Key */
  hasTypedKey: boolean;
  /** null = 钥匙串检查中 */
  keychainPresent: boolean | null;
  probeState: "idle" | "ok" | "fail";
};

export function resolveLlmConnectionUiStatus(input: LlmConnectionUiStatusInput): LlmConnectionUiStatus {
  if (input.hasTypedKey || input.hasLocalKeyRef) {
    if (input.keychainPresent === false && !input.hasTypedKey && !getLlmApiKeyFromMemory()?.trim()) {
      return "keychain_missing";
    }
    if (input.probeState === "ok") return "verified";
    return "unverified";
  }
  return "missing";
}

export function llmConnectionStatusMessage(status: LlmConnectionUiStatus): string {
  switch (status) {
    case "missing":
      return llmConfigHint();
    case "keychain_missing":
      return "配置里记录了密钥引用，但系统钥匙串中读不到。请重新填写 DeepSeek API Key 并保存。";
    case "unverified":
      return "密钥已就位，尚未验证连通性。请点击「探测连接」确认后再使用自动标点。";
    case "verified":
      return "连接已验证：编辑器中的自动标点等能力可用。";
  }
}

export function llmConnectionStatusTone(status: LlmConnectionUiStatus): "error" | "warn" | "ok" {
  switch (status) {
    case "missing":
    case "keychain_missing":
      return "error";
    case "unverified":
      return "warn";
    case "verified":
      return "ok";
  }
}

export function llmAutoPunctuateCapabilityBadge(status: LlmConnectionUiStatus): string {
  switch (status) {
    case "missing":
      return "待配置";
    case "keychain_missing":
      return "密钥异常";
    case "unverified":
      return "待验证";
    case "verified":
      return "可用";
  }
}

export function llmKeychainReferenceMessage(apiKeyId: string | null, keychainPresent: boolean | null): string {
  const label = apiKeyId ? (normalizeLlmApiKeyId(apiKeyId) ?? DEFAULT_LLM_API_KEY_ID) : null;
  if (!label) return "系统钥匙串：当前未保存 API Key。";
  if (keychainPresent === null) return `系统钥匙串：正在检查已保存引用（标识：${label}）…`;
  if (keychainPresent) {
    return `系统钥匙串：已找到 API Key（标识：${label}）。输入框留空时将使用它。`;
  }
  return `系统钥匙串：未读到标识为「${label}」的密钥。请重新填写 DeepSeek API Key 并点击保存配置。`;
}

export function resolveAutoPunctuateBlockReason(input: {
  currentFileId: string | null;
  hasSegmentText: boolean;
  keychainReady: boolean;
  keychainChecking: boolean;
}): string | null {
  if (!input.currentFileId || !input.hasSegmentText) {
    return "请先选中一条有正文的语段。";
  }
  if (!isLlmRuntimeReady()) {
    return llmConfigHint();
  }
  if (input.keychainChecking) {
    return "正在检查 LLM 密钥状态…";
  }
  if (!input.keychainReady && !getLlmApiKeyFromMemory()?.trim()) {
    return "系统钥匙串中未找到 API Key，请在设置 → LLM 配置 中重新保存。";
  }
  return null;
}

export function tryBuildPostprocessRuntimeBridge(): PostprocessRuntimeBridge | null {
  const cfg = readLlmRuntimeConfigFromStorage();
  const def = getLlmProviderDefinition(cfg.providerId);
  const apiKey = getLlmApiKeyFromMemory()?.trim();
  const apiKeyId = normalizeLlmApiKeyId(cfg.apiKeyId?.trim());
  if (!def || (!apiKey && !apiKeyId)) return null;
  const base = cfg.baseUrl.trim() || def.defaultBaseUrl;
  const allowInsecureHttp =
    base.startsWith("http://127.0.0.1") || base.startsWith("http://localhost");
  const runtime: PostprocessRuntimeBridge = {
    provider: def.label,
    baseUrl: base,
    model: cfg.model.trim() || def.defaultModel,
    allowInsecureHttp: allowInsecureHttp || undefined,
  };
  if (apiKey) runtime.apiKey = apiKey;
  else if (apiKeyId) runtime.apiKeyId = apiKeyId;
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
