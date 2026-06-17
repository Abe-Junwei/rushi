/** 当前持久化键（LLM 配置真源） */
export const LLM_STORAGE_KEYS = {
  providerId: "rushi.llm.providerId",
  baseUrl: "rushi.llm.baseUrl",
  model: "rushi.llm.model",
  apiKeyId: "rushi.llm.apiKeyId",
  /** 最近一次 chat 路径验证成功的配置指纹（探测或自动标点成功时写入） */
  connectionVerifiedFingerprint: "rushi.llm.connectionVerifiedFingerprint",
  /** 上次使用的云端厂商快照（本机 ↔ 云端切换时恢复） */
  lastCloudProviderId: "rushi.llm.lastCloudProviderId",
  lastCloudBaseUrl: "rushi.llm.lastCloudBaseUrl",
  lastCloudModel: "rushi.llm.lastCloudModel",
  lastCloudApiKeyId: "rushi.llm.lastCloudApiKeyId",
  /** 智能改稿 system 提示词覆盖（空则使用内置默认） */
  promptStageBSystem: "rushi.llm.prompt.stageBSystem",
  /** 智能改稿 user 指令块覆盖（词表/语段仍由客户端追加） */
  promptStageBInstructions: "rushi.llm.prompt.stageBInstructions",
  promptAutoPunctuateSystem: "rushi.llm.prompt.autoPunctuateSystem",
  promptAutoPunctuateInstructions: "rushi.llm.prompt.autoPunctuateInstructions",
  promptExportPolishSystem: "rushi.llm.prompt.exportPolishSystem",
  promptExportPolishInstructions: "rushi.llm.prompt.exportPolishInstructions",
} as const;

export const LLM_CONNECTION_VERIFIED_EVENT = "rushi:llm-connection-verified";

/** @deprecated 仅用于从旧版「自动标点」页迁移 */
export const LEGACY_POSTPROCESS_STORAGE_KEYS = {
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
  | "openrouter"
  | "ollama";

/** 云端 API vs 本机 loopback（LLM-LOC-4a）。 */
export type LlmProviderKind = "cloud" | "local_loopback";

export const OLLAMA_LOOPBACK_PLACEHOLDER_API_KEY = "ollama";

export const OLLAMA_DEFAULT_BASE_URL = "http://127.0.0.1:11434/v1";
export const OLLAMA_DEFAULT_MODEL = "qwen2.5:7b";

export type LlmProviderDefinition = {
  id: LlmProviderId;
  kind: LlmProviderKind;
  label: string;
  description: string;
  docsUrl: string;
  defaultBaseUrl: string;
  defaultModel: string;
  modelExamples: string[];
};

export const LLM_PROVIDER_DEFINITIONS: LlmProviderDefinition[] = [
  {
    id: "ollama",
    kind: "local_loopback",
    label: "Ollama（本机）",
    description:
      "数据不出本机：连接本机 Ollama OpenAI 兼容接口。须先安装 Ollama 并 pull 模型（推荐 qwen2.5:7b）。适合导出润色等本机 LLM 任务。",
    docsUrl: "https://github.com/ollama/ollama/blob/main/docs/api.md",
    defaultBaseUrl: OLLAMA_DEFAULT_BASE_URL,
    defaultModel: OLLAMA_DEFAULT_MODEL,
    modelExamples: ["qwen2.5:7b", "qwen2.5:14b", "qwen2.5:3b"],
  },
  {
    id: "deepseek",
    kind: "cloud",
    label: "DeepSeek",
    description: "深度求索 OpenAI 兼容 API，适合中文标点与通用文本任务。",
    docsUrl: "https://platform.deepseek.com/api-docs/",
    defaultBaseUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
    modelExamples: ["deepseek-chat", "deepseek-reasoner"],
  },
  {
    id: "kimi",
    kind: "cloud",
    label: "Kimi（Moonshot）",
    description: "月之暗面 Moonshot 开放平台；Kimi 系列模型同一兼容端点。",
    docsUrl: "https://platform.moonshot.cn/docs/api/chat",
    defaultBaseUrl: "https://api.moonshot.cn/v1",
    defaultModel: "moonshot-v1-8k",
    modelExamples: ["moonshot-v1-8k", "moonshot-v1-32k", "kimi-k2-0711-preview"],
  },
  {
    id: "qwen",
    kind: "cloud",
    label: "通义千问（阿里百炼）",
    description: "阿里云百炼 OpenAI 兼容接口；适合中文通用任务，可直接切换 Qwen 系列模型。",
    docsUrl: "https://help.aliyun.com/zh/model-studio/compatibility-of-openai-with-dashscope",
    defaultBaseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    defaultModel: "qwen-plus",
    modelExamples: ["qwen-plus", "qwen-turbo", "qwen-max"],
  },
  {
    id: "siliconflow",
    kind: "cloud",
    label: "SiliconFlow",
    description: "硅基流动 OpenAI 兼容接口；国内开发者常用，适合按模型族灵活切换。",
    docsUrl: "https://docs.siliconflow.com/en/api-reference/chat-completions/chat-completions",
    defaultBaseUrl: "https://api.siliconflow.com/v1",
    defaultModel: "Qwen/Qwen3-8B",
    modelExamples: ["Qwen/Qwen3-8B", "deepseek-ai/DeepSeek-V3", "deepseek-ai/DeepSeek-R1"],
  },
  {
    id: "doubao",
    kind: "cloud",
    label: "火山方舟（Doubao）",
    description: "火山引擎方舟 OpenAI 兼容入口；`model` 通常填写你在方舟控制台创建的 endpoint ID。",
    docsUrl: "https://console.volcengine.com/ark",
    defaultBaseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    defaultModel: "ep-your-endpoint-id",
    modelExamples: ["ep-your-endpoint-id", "ep-20260525-example", "ep-prod-doubao"],
  },
  {
    id: "openai",
    kind: "cloud",
    label: "OpenAI",
    description: "国际通用参考实现；适合作为兼容基线或海外直连备选。",
    docsUrl: "https://platform.openai.com/docs/api-reference/chat",
    defaultBaseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    modelExamples: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini"],
  },
  {
    id: "openrouter",
    kind: "cloud",
    label: "OpenRouter",
    description: "统一聚合多家海外模型的 OpenAI 兼容入口；适合兼顾国外模型覆盖面。",
    docsUrl: "https://openrouter.ai/docs/quickstart",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "~openai/gpt-latest",
    modelExamples: ["~openai/gpt-latest", "openai/gpt-4o-mini", "anthropic/claude-3.5-sonnet"],
  },
];

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

export function getLlmProviderDefinition(id: string): LlmProviderDefinition | undefined {
  return LLM_PROVIDER_DEFINITIONS.find((d) => d.id === id);
}

export function getLlmProviderKind(providerId: LlmProviderId): LlmProviderKind {
  return getLlmProviderDefinition(providerId)?.kind ?? "cloud";
}

export function isLocalLoopbackLlmProvider(providerId: string): boolean {
  return getLlmProviderKind(providerId as LlmProviderId) === "local_loopback";
}
