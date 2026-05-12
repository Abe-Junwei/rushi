/**
 * 在线 STT Provider 合约（对齐解语 `acousticProviderContract` 的结构：定义表、运行时配置、
 * 密钥不落盘、HTTPS/localhost 端点策略、健康探测）。
 *
 * 各厂商具体 transcribe 请求/响应映射在后续 PR 实现；此处仅提供共享配置与健康检查骨架。
 */

export type SttOnlineAuthStyle = "bearer" | "header";

/** 与解语 acoustic 定义表「国内 / 国际」分组展示一致 */
export type SttOnlineMarket = "china" | "global";

export interface SttOnlineProviderCapability {
  batchRest: boolean;
  streaming: boolean;
  asyncJob: boolean;
  /** 厂商是否常提供分句级时间戳（或可由词级拼出） */
  segmentTimestamps: boolean;
}

export interface SttOnlineProviderDefinition {
  id: string;
  label: string;
  description: string;
  /** 文档入口，便于环境与 ASR 面板外链 */
  docsUrl: string;
  authStyle: SttOnlineAuthStyle;
  headerName?: string;
  defaultTimeoutMs: number;
  capabilities: SttOnlineProviderCapability;
  experimental: boolean;
  /** 列表分组：国内厂商走「国内」optgroup */
  market: SttOnlineMarket;
  /**
   * 与解语「非敏感项可持久化、根密钥仅会话」一致：为 true 时 `appKey` 写入 localStorage，
   * 内存字段仍放 Token / Secret / API Key 等根凭证（如阿里云 NLS 的 X-NLS-Token）。
   */
  requiresPersistedAppKey?: boolean;
  /** 持久化应用标识输入框标签 */
  persistedAppKeyFieldLabel?: string;
  /** 典型网关或区域基址示例，用于占位提示（用户仍须填 HTTPS 完整转写 URL 或自建代理） */
  defaultEndpointExample?: string;
  /**
   * 若厂商常见提供新用户试用 / 免费额度，填简短备注；`sttOnlineProvidersByMarket` 会将其排在分组列表前。
   * 文案勿写死具体金额，以各控制台为准。
   */
  freeTierNote?: string;
}

export interface ExternalSttOnlineRuntimeConfig {
  enabled: boolean;
  /** 当前在 UI 中选中的厂商 id（见 STT_ONLINE_PROVIDER_DEFINITIONS） */
  selectedProviderId: string;
  /** 覆盖默认文档 URL 的 API 根或代理根；健康检查对其发 GET */
  endpoint?: string;
  /** 应用级标识（AppKey、ProjectId 等），可持久化；与解语 acoustic 分层存储一致 */
  appKey?: string;
  timeoutMs: number;
}

export type ExternalSttOnlineHealthState =
  | "available"
  | "disabled"
  | "unconfigured"
  | "aborted"
  | "unauthorized"
  | "forbidden"
  | "timeout"
  | "network-error"
  | "http-error"
  | "unknown-error";

export interface ExternalSttOnlineHealthCheckResult {
  state: ExternalSttOnlineHealthState;
  available: boolean;
  endpoint?: string;
  status?: number;
  latencyMs?: number;
  message?: string;
}

export interface ExternalSttOnlineHealthCheckOptions {
  runtimeConfig?: ExternalSttOnlineRuntimeConfig;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}

export const STT_ONLINE_PROVIDER_STORAGE_KEYS = {
  enabled: "rushi.stt.online.enabled",
  selectedProviderId: "rushi.stt.online.selectedProviderId",
  endpoint: "rushi.stt.online.endpoint",
  appKey: "rushi.stt.online.appKey",
  timeoutMs: "rushi.stt.online.timeoutMs",
} as const;

/** OpenAI Audio Transcriptions；未填 endpoint 时 Tauri 走此默认。 */
export const STT_ONLINE_OPENAI_DEFAULT_TRANSCRIBE_URL = "https://api.openai.com/v1/audio/transcriptions";

/** AssemblyAI API 根；未填 endpoint 时 Tauri 使用 `${base}/v2/upload` 等。 */
export const STT_ONLINE_ASSEMBLYAI_DEFAULT_BASE_URL = "https://api.assemblyai.com";

const STT_ONLINE_OPENAI_DEFAULT_PROBE_URL = "https://api.openai.com/v1/models";
const STT_ONLINE_ASSEMBLYAI_DEFAULT_PROBE_URL = "https://api.assemblyai.com/v2/upload";

const DEFAULT_TIMEOUT_MS = 30_000;

const inMemorySttSecrets: { apiKey?: string } = {};

const INVALID_ENDPOINT_MESSAGE =
  "在线 STT 端点须使用 HTTPS；仅 localhost / 127.0.0.1 / ::1 允许 HTTP。";

function parseEndpointUrl(endpoint: string): URL | null {
  try {
    return new URL(endpoint.trim());
  } catch {
    return null;
  }
}

function isLoopbackHostname(hostname: string): boolean {
  const n = hostname.trim().toLowerCase();
  return n === "localhost" || n === "127.0.0.1" || n === "::1" || n === "[::1]";
}

/** 与解语 `isAllowedExternalProviderEndpoint` 同构 */
export function isAllowedSttOnlineEndpoint(endpoint: string): boolean {
  const parsed = parseEndpointUrl(endpoint);
  if (!parsed) return false;
  if (parsed.protocol === "https:") return true;
  if (parsed.protocol !== "http:") return false;
  return isLoopbackHostname(parsed.hostname);
}

function assertValidEndpoint(endpoint?: string): void {
  const t = endpoint?.trim();
  if (!t) return;
  if (!isAllowedSttOnlineEndpoint(t)) {
    throw new Error(INVALID_ENDPOINT_MESSAGE);
  }
}

function normalizeTimeoutMs(raw: string | null | undefined): number {
  if (!raw) return DEFAULT_TIMEOUT_MS;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_TIMEOUT_MS;
  return Math.max(3_000, Math.min(600_000, Math.round(n)));
}

function readStorage(key: string): string | null {
  try {
    if (!("localStorage" in globalThis) || !globalThis.localStorage) return null;
    return globalThis.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null | undefined): void {
  try {
    if (!("localStorage" in globalThis) || !globalThis.localStorage) return;
    if (value == null || value === "") globalThis.localStorage.removeItem(key);
    else globalThis.localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

/** 市面常见在线 STT + 国内主流云厂商（能力为典型形态，以各厂商文档为准；部分由桌面壳 `stt_native` 直连，其余可走自建网关归一为 Rushi JSON）。 */
export const STT_ONLINE_PROVIDER_DEFINITIONS: SttOnlineProviderDefinition[] = [
  {
    id: "aliyun-nls",
    label: "阿里云智能语音交互（NLS）",
    description:
      "一句话识别 REST（nls-gateway 区域域名）；AppKey 持久化，Token（X-NLS-Token）放内存。长音频建议录音文件识别或自建代理。",
    docsUrl: "https://help.aliyun.com/zh/isi/developer-reference/restful-api-2",
    authStyle: "header",
    headerName: "X-NLS-Token",
    defaultTimeoutMs: 120_000,
    capabilities: { batchRest: true, streaming: true, asyncJob: true, segmentTimestamps: true },
    experimental: true,
    market: "china",
    requiresPersistedAppKey: true,
    persistedAppKeyFieldLabel: "NLS AppKey（可持久化）",
    defaultEndpointExample: "https://nls-gateway-cn-shanghai.aliyuncs.com/stream/v1/asr",
    freeTierNote: "（新用户多含试用/免费额，以控制台为准）",
  },
  {
    id: "tencent-asr",
    label: "腾讯云语音识别",
    description:
      "API 3.0 SentenceRecognition（asr.tencentcloudapi.com）；桌面壳内 TC3-HMAC-SHA256 直连。SecretId 可持久化，SecretKey 仅内存。",
    docsUrl: "https://cloud.tencent.com/document/product/1093/35646",
    authStyle: "bearer",
    defaultTimeoutMs: 120_000,
    capabilities: { batchRest: true, streaming: true, asyncJob: false, segmentTimestamps: true },
    experimental: true,
    market: "china",
    requiresPersistedAppKey: true,
    persistedAppKeyFieldLabel: "SecretId（可持久化）",
    defaultEndpointExample: "https://asr.tencentcloudapi.com/",
    freeTierNote: "（新用户多含试用/免费额，以控制台为准）",
  },
  {
    id: "baidu-speech",
    label: "百度语音技术（开放平台）",
    description:
      "短语音识别标准版（vop.baidu.com/server_api）；桌面壳内 OAuth + 识别。API Key 可持久化，Secret Key 仅内存。",
    docsUrl: "https://ai.baidu.com/tech/speech/asr",
    authStyle: "bearer",
    defaultTimeoutMs: 120_000,
    capabilities: { batchRest: true, streaming: false, asyncJob: false, segmentTimestamps: false },
    experimental: true,
    market: "china",
    requiresPersistedAppKey: true,
    persistedAppKeyFieldLabel: "API Key（可持久化，对应 client_id）",
    defaultEndpointExample: "https://vop.baidu.com/server_api",
    freeTierNote: "（开放平台常见有免费调用额，以控制台为准）",
  },
  {
    id: "iflytek-speech",
    label: "科大讯飞语音识别",
    description:
      "语音听写 WebAPI v2（iat-api.xfyun.cn）；壳内 WebSocket + HMAC 鉴权。AppId 持久化；内存填 `APIKey|APISecret`（控制台 WebAPI 密钥）。当前壳实现仅支持 WAV/PCM 16k 单声道。",
    docsUrl: "https://www.xfyun.cn/doc/asr/voicedictation/API.html",
    authStyle: "header",
    headerName: "Authorization",
    defaultTimeoutMs: 120_000,
    capabilities: { batchRest: true, streaming: true, asyncJob: false, segmentTimestamps: true },
    experimental: true,
    market: "china",
    requiresPersistedAppKey: true,
    persistedAppKeyFieldLabel: "讯飞 AppId（可持久化）",
    freeTierNote: "（新应用常见有试用/免费额，以控制台为准）",
  },
  {
    id: "huawei-sis",
    label: "华为云语音交互服务（SIS）",
    description:
      "RecognizeShortAudio；壳内 SDK-HMAC-SHA256。ProjectId 持久化；内存 `AccessKeyId|SecretAccessKey`；endpoint 可填区域 HTTPS 基址（示例 cn-north-4）。",
    docsUrl: "https://support.huaweicloud.com/api-sisapi/sis_03_0021.html",
    authStyle: "bearer",
    defaultTimeoutMs: 120_000,
    capabilities: { batchRest: true, streaming: true, asyncJob: false, segmentTimestamps: true },
    experimental: true,
    market: "china",
    requiresPersistedAppKey: true,
    persistedAppKeyFieldLabel: "ProjectId（可持久化）",
    defaultEndpointExample: "https://sis-ext.cn-north-4.myhuaweicloud.com",
    freeTierNote: "（新账号多含试用/免费额，以控制台为准）",
  },
  {
    id: "volcengine-speech",
    label: "火山引擎（字节）语音识别",
    description:
      "豆包大模型 ASR v3（bigmodel_nostream WebSocket）；壳内二进制帧。AppId 持久化；内存填控制台 Access Token；可选 endpoint 填 Resource-Id（默认 volc.bigasr.sauc.duration）。",
    docsUrl: "https://www.volcengine.com/docs/6561/79817",
    authStyle: "bearer",
    defaultTimeoutMs: 120_000,
    capabilities: { batchRest: true, streaming: true, asyncJob: false, segmentTimestamps: true },
    experimental: true,
    market: "china",
    requiresPersistedAppKey: true,
    persistedAppKeyFieldLabel: "X-Api-App-Key（AppId，可持久化）",
    freeTierNote: "（新用户多含试用/赠额，以控制台为准）",
  },
  {
    id: "aispeech",
    label: "思必驰（AISpeech）",
    description:
      "DUI 一句话 LASR v2（lasr.duiopen.com）；壳内 multipart。ProductId 持久化；内存填云对云 apiKey。",
    docsUrl: "https://cloud.aispeech.com/docs/ct_asr_sentence",
    authStyle: "bearer",
    defaultTimeoutMs: 120_000,
    capabilities: { batchRest: true, streaming: true, asyncJob: false, segmentTimestamps: true },
    experimental: true,
    market: "china",
    requiresPersistedAppKey: true,
    persistedAppKeyFieldLabel: "ProductId（可持久化）",
  },
  {
    id: "openai",
    label: "OpenAI",
    description: "Whisper / gpt-4o-mini-transcribe 等音频转写 REST，Bearer Token。",
    docsUrl: "https://platform.openai.com/docs/guides/speech-to-text",
    authStyle: "bearer",
    defaultTimeoutMs: 600_000,
    capabilities: {
      batchRest: true,
      streaming: true,
      asyncJob: false,
      segmentTimestamps: true,
    },
    experimental: false,
    market: "global",
    freeTierNote: "（新账户或活动期或有试用额，以平台账单为准）",
  },
  {
    id: "assemblyai",
    label: "AssemblyAI",
    description: "异步转写 Job + 轮询/Webhook；流式 Universal-Streaming。",
    docsUrl: "https://www.assemblyai.com/docs",
    authStyle: "header",
    headerName: "authorization",
    defaultTimeoutMs: 600_000,
    capabilities: {
      batchRest: true,
      streaming: true,
      asyncJob: true,
      segmentTimestamps: true,
    },
    experimental: false,
    market: "global",
    freeTierNote: "（开发者常见有免费试用额，以控制台为准）",
  },
  {
    id: "deepgram",
    label: "Deepgram",
    description: "Nova 等模型；流式与 REST 预录转写，Token / Bearer。",
    docsUrl: "https://developers.deepgram.com/docs",
    authStyle: "bearer",
    defaultTimeoutMs: 120_000,
    capabilities: {
      batchRest: true,
      streaming: true,
      asyncJob: false,
      segmentTimestamps: true,
    },
    experimental: false,
    market: "global",
    freeTierNote: "（新账户常见有免费试用额，以控制台为准）",
  },
  {
    id: "google-cloud-stt",
    label: "Google Cloud Speech-to-Text",
    description: "Chirp 等；服务账号 OAuth2，批量与流式 gRPC/REST。",
    docsUrl: "https://cloud.google.com/speech-to-text/docs",
    authStyle: "bearer",
    defaultTimeoutMs: 600_000,
    capabilities: {
      batchRest: true,
      streaming: true,
      asyncJob: true,
      segmentTimestamps: true,
    },
    experimental: true,
    market: "global",
    freeTierNote: "（GCP 新用户常见含试用额，以结算为准）",
  },
  {
    id: "azure-speech",
    label: "Microsoft Azure Speech",
    description: "区域终结点 + Key 或 Token；实时与批量。",
    docsUrl: "https://learn.microsoft.com/azure/ai-services/speech-service/",
    authStyle: "header",
    headerName: "Ocp-Apim-Subscription-Key",
    defaultTimeoutMs: 600_000,
    capabilities: {
      batchRest: true,
      streaming: true,
      asyncJob: false,
      segmentTimestamps: true,
    },
    experimental: true,
    market: "global",
    freeTierNote: "（Azure 新订阅常见含试用额，以门户为准）",
  },
  {
    id: "custom-proxy",
    label: "自定义代理（Rushi 契约）",
    description:
      "自建 HTTPS 网关，将各厂商响应归一为 Rushi `TranscriptionResult` schema_version 1；与本机 rushi_asr 并存。",
    docsUrl: "https://example.com",
    authStyle: "bearer",
    defaultTimeoutMs: 600_000,
    capabilities: {
      batchRest: true,
      streaming: false,
      asyncJob: false,
      segmentTimestamps: true,
    },
    experimental: true,
    market: "global",
  },
];

/** 下拉框等处的展示文案：名称 + 实验标记 + 免费额备注（若有）。 */
export function formatSttOnlineProviderSelectLabel(d: SttOnlineProviderDefinition): string {
  let s = d.label;
  if (d.experimental) s += "（实验）";
  if (d.freeTierNote) s += ` ${d.freeTierNote}`;
  return s;
}

export function sttOnlineProvidersByMarket(market: SttOnlineMarket): SttOnlineProviderDefinition[] {
  const list = STT_ONLINE_PROVIDER_DEFINITIONS.filter((d) => d.market === market);
  const withIndex = list.map((d, definitionOrder) => ({
    d,
    definitionOrder,
    freeFirst: d.freeTierNote ? 1 : 0,
  }));
  withIndex.sort((a, b) => {
    if (b.freeFirst !== a.freeFirst) return b.freeFirst - a.freeFirst;
    return a.definitionOrder - b.definitionOrder;
  });
  return withIndex.map((x) => x.d);
}

export function getSttOnlineProviderDefinition(id: string): SttOnlineProviderDefinition | undefined {
  return STT_ONLINE_PROVIDER_DEFINITIONS.find((d) => d.id === id);
}

export function normalizeExternalSttOnlineRuntimeConfig(
  partial?: Partial<ExternalSttOnlineRuntimeConfig> | null,
): ExternalSttOnlineRuntimeConfig {
  const selected =
    partial?.selectedProviderId?.trim() && getSttOnlineProviderDefinition(partial.selectedProviderId.trim())
      ? partial.selectedProviderId.trim()
      : "openai";
  const endpointCandidate = partial?.endpoint?.trim();
  const endpoint =
    endpointCandidate && isAllowedSttOnlineEndpoint(endpointCandidate) ? endpointCandidate : undefined;
  const appKeyRaw = partial?.appKey?.trim();
  const appKey =
    appKeyRaw && appKeyRaw.length > 0 ? appKeyRaw.slice(0, 512) : undefined;
  return {
    enabled: Boolean(partial?.enabled),
    selectedProviderId: selected,
    ...(endpoint ? { endpoint } : {}),
    ...(appKey ? { appKey } : {}),
    timeoutMs:
      typeof partial?.timeoutMs === "number" && Number.isFinite(partial.timeoutMs)
        ? Math.max(3_000, Math.min(600_000, Math.round(partial.timeoutMs)))
        : normalizeTimeoutMs(undefined),
  };
}

export function readExternalSttOnlineRuntimeConfigFromStorage(): ExternalSttOnlineRuntimeConfig {
  const enabledRaw = readStorage(STT_ONLINE_PROVIDER_STORAGE_KEYS.enabled);
  const selected = (readStorage(STT_ONLINE_PROVIDER_STORAGE_KEYS.selectedProviderId) ?? "openai").trim();
  const endpoint = (readStorage(STT_ONLINE_PROVIDER_STORAGE_KEYS.endpoint) ?? "").trim();
  const appKey = (readStorage(STT_ONLINE_PROVIDER_STORAGE_KEYS.appKey) ?? "").trim();
  const timeoutRaw = readStorage(STT_ONLINE_PROVIDER_STORAGE_KEYS.timeoutMs);
  return normalizeExternalSttOnlineRuntimeConfig({
    enabled: enabledRaw === "1" || enabledRaw === "true",
    selectedProviderId: getSttOnlineProviderDefinition(selected) ? selected : "openai",
    ...(endpoint ? { endpoint } : {}),
    ...(appKey ? { appKey } : {}),
    timeoutMs: normalizeTimeoutMs(timeoutRaw),
  });
}

export function resolveExternalSttOnlineRuntimeConfig(): ExternalSttOnlineRuntimeConfig {
  return normalizeExternalSttOnlineRuntimeConfig(readExternalSttOnlineRuntimeConfigFromStorage());
}

/** 仅内存保存 API Key（与解语 acoustic 一致：不落 localStorage）。 */
export function setSttOnlineApiKeyInMemory(apiKey: string | null | undefined): void {
  const t = apiKey?.trim();
  if (t) inMemorySttSecrets.apiKey = t;
  else delete inMemorySttSecrets.apiKey;
}

export function getSttOnlineApiKeyFromMemory(): string | undefined {
  return inMemorySttSecrets.apiKey;
}

/** 与 Tauri `stt_native::dispatch_native` 的 `native_adapter` 一致（壳内直连）。 */
export type P1OnlineNativeAdapterId =
  | "openaiAudio"
  | "assemblyai"
  | "baiduSpeech"
  | "aliyunNls"
  | "deepgramListen"
  | "tencentAsr"
  | "azureConversationV1"
  | "googleSpeechV1"
  | "iflytekIatWs"
  | "huaweiSisShortAudio"
  | "aispeechLasrSentenceV2"
  | "volcengineBigmodelNostreamWs";

/** 所选厂商是否由桌面壳内置 HTTP 直连（可省略自定义 endpoint，由 Rust 填默认 URL）。 */
export function resolveShellNativeSttAdapterId(providerId: string): P1OnlineNativeAdapterId | null {
  switch (providerId) {
    case "openai":
      return "openaiAudio";
    case "assemblyai":
      return "assemblyai";
    case "baidu-speech":
      return "baiduSpeech";
    case "aliyun-nls":
      return "aliyunNls";
    case "deepgram":
      return "deepgramListen";
    case "tencent-asr":
      return "tencentAsr";
    case "azure-speech":
      return "azureConversationV1";
    case "google-cloud-stt":
      return "googleSpeechV1";
    case "iflytek-speech":
      return "iflytekIatWs";
    case "huawei-sis":
      return "huaweiSisShortAudio";
    case "aispeech":
      return "aispeechLasrSentenceV2";
    case "volcengine-speech":
      return "volcengineBigmodelNostreamWs";
    default:
      return null;
  }
}

/** 未填 endpoint 时仍可用默认厂商端点完成转写 / 探测的厂商。 */
export function sttOnlineProviderAllowsEmptyEndpoint(providerId: string): boolean {
  return resolveShellNativeSttAdapterId(providerId) != null;
}

/**
 * 健康探测实际请求的 URL（显式 endpoint 优先；OpenAI / AssemblyAI 无 endpoint 时用默认探测点）。
 */
export function resolveSttOnlineProbeUrl(runtime: ExternalSttOnlineRuntimeConfig): string | null {
  const explicit = runtime.endpoint?.trim();
  if (explicit) {
    if (!isAllowedSttOnlineEndpoint(explicit)) return null;
    return explicit;
  }
  if (runtime.selectedProviderId === "openai") return STT_ONLINE_OPENAI_DEFAULT_PROBE_URL;
  if (runtime.selectedProviderId === "assemblyai") return STT_ONLINE_ASSEMBLYAI_DEFAULT_PROBE_URL;
  return null;
}

/** 供 Tauri `p1_project_run_transcribe` 的 `online` 参数；与 Rust `P1OnlineTranscribeBridge` 字段 camelCase 对齐。 */
export type P1OnlineTranscribeBridgePayload = {
  transcribeUrl: string;
  authorization?: string | null;
  timeoutSec?: number | null;
  /** 非空时 Rust 走厂商原生 API，再归一为 Rushi `TranscriptionResult` JSON。 */
  nativeAdapter?: P1OnlineNativeAdapterId | null;
  /** 应用级标识（AppKey 等），由自建网关读取请求头 `X-Rushi-Stt-App-Key`（若设置）。 */
  appKey?: string | null;
};

/**
 * 若已启用在线 STT 且具备密钥（及壳直连厂商所需的持久化 AppKey），则返回 Tauri 载荷；否则返回 null（走本机 ASR）。
 * 启用但未配全时由调用方提示错误，避免静默回落。
 */
export function tryBuildP1OnlineTranscribeBridgePayload(): P1OnlineTranscribeBridgePayload | null {
  const c = readExternalSttOnlineRuntimeConfigFromStorage();
  const key = getSttOnlineApiKeyFromMemory()?.trim();
  if (!c.enabled || !key) return null;
  const def = getSttOnlineProviderDefinition(c.selectedProviderId);
  if (!def) return null;
  const timeoutSec = Math.min(600, Math.max(30, Math.round(c.timeoutMs / 1000)));
  const authorization = def.authStyle === "bearer" ? `Bearer ${key}` : key;
  const shellAdapter = resolveShellNativeSttAdapterId(c.selectedProviderId);

  if (shellAdapter === "openaiAudio") {
    const transcribeUrl = (c.endpoint?.trim() || STT_ONLINE_OPENAI_DEFAULT_TRANSCRIBE_URL).trim();
    if (!isAllowedSttOnlineEndpoint(transcribeUrl)) return null;
    const appKeyTrim = c.appKey?.trim();
    return {
      transcribeUrl,
      authorization,
      timeoutSec,
      nativeAdapter: "openaiAudio",
      ...(appKeyTrim ? { appKey: appKeyTrim } : {}),
    };
  }
  if (shellAdapter === "assemblyai") {
    const transcribeUrl = (c.endpoint?.trim() || STT_ONLINE_ASSEMBLYAI_DEFAULT_BASE_URL).replace(/\/+$/, "");
    if (!isAllowedSttOnlineEndpoint(transcribeUrl)) return null;
    const appKeyTrim = c.appKey?.trim();
    return {
      transcribeUrl,
      authorization,
      timeoutSec,
      nativeAdapter: "assemblyai",
      ...(appKeyTrim ? { appKey: appKeyTrim } : {}),
    };
  }
  if (shellAdapter) {
    if (def.requiresPersistedAppKey && !c.appKey?.trim()) return null;
    const endpointTrim = c.endpoint?.trim() ?? "";
    if (endpointTrim && !isAllowedSttOnlineEndpoint(endpointTrim)) return null;
    const appKeyTrim = c.appKey?.trim();
    return {
      transcribeUrl: endpointTrim,
      authorization,
      timeoutSec,
      nativeAdapter: shellAdapter,
      ...(appKeyTrim ? { appKey: appKeyTrim } : {}),
    };
  }

  const transcribeUrl = c.endpoint?.trim() ?? "";
  if (!transcribeUrl || !isAllowedSttOnlineEndpoint(transcribeUrl)) return null;
  const appKeyTrim = c.appKey?.trim();
  return {
    transcribeUrl,
    authorization,
    timeoutSec,
    ...(appKeyTrim ? { appKey: appKeyTrim } : {}),
  };
}

/** 已勾选在线但未凑齐 URL/密钥时用于主舞台提示。 */
export function isSttOnlineEnabledButIncomplete(): boolean {
  const c = readExternalSttOnlineRuntimeConfigFromStorage();
  if (!c.enabled) return false;
  const key = getSttOnlineApiKeyFromMemory()?.trim();
  if (!key) return true;
  const def = getSttOnlineProviderDefinition(c.selectedProviderId);
  if (def?.requiresPersistedAppKey && !(c.appKey?.trim())) return true;
  const url = c.endpoint?.trim() ?? "";
  if (sttOnlineProviderAllowsEmptyEndpoint(c.selectedProviderId)) {
    if (!url) return false;
    return !isAllowedSttOnlineEndpoint(url);
  }
  return !url || !isAllowedSttOnlineEndpoint(url);
}

export function persistExternalSttOnlineRuntimeConfig(
  config: ExternalSttOnlineRuntimeConfig,
): ExternalSttOnlineRuntimeConfig {
  assertValidEndpoint(config.endpoint);
  const n = normalizeExternalSttOnlineRuntimeConfig(config);
  writeStorage(STT_ONLINE_PROVIDER_STORAGE_KEYS.enabled, n.enabled ? "true" : "false");
  writeStorage(STT_ONLINE_PROVIDER_STORAGE_KEYS.selectedProviderId, n.selectedProviderId);
  writeStorage(STT_ONLINE_PROVIDER_STORAGE_KEYS.endpoint, n.endpoint ?? null);
  writeStorage(STT_ONLINE_PROVIDER_STORAGE_KEYS.appKey, n.appKey ?? null);
  writeStorage(STT_ONLINE_PROVIDER_STORAGE_KEYS.timeoutMs, String(n.timeoutMs));
  return n;
}

function authHeaderForProbe(def: SttOnlineProviderDefinition, apiKey: string): Record<string, string> {
  if (def.authStyle === "bearer") {
    return { authorization: `Bearer ${apiKey}` };
  }
  const raw = (def.headerName ?? "Authorization").trim();
  if (raw.toLowerCase() === "authorization") {
    return { authorization: apiKey };
  }
  return { [raw]: apiKey };
}

/**
 * 对配置的 `endpoint` 发 GET（与解语 `probeExternalAcousticProviderHealth` 同构）。
 * 多数云厂商根 URL 未必支持 GET 200；失败仅表示「未校验通过」，不阻塞后续在 Tauri 内走专用路径。
 */
export async function probeExternalSttOnlineHealth(
  options: ExternalSttOnlineHealthCheckOptions = {},
): Promise<ExternalSttOnlineHealthCheckResult> {
  const runtime = normalizeExternalSttOnlineRuntimeConfig(options.runtimeConfig ?? resolveExternalSttOnlineRuntimeConfig());
  if (!runtime.enabled) {
    return { state: "disabled", available: false, message: "在线 STT 未启用。" };
  }
  const explicit = runtime.endpoint?.trim();
  if (explicit && !isAllowedSttOnlineEndpoint(explicit)) {
    return {
      state: "unconfigured",
      available: false,
      endpoint: explicit,
      message: INVALID_ENDPOINT_MESSAGE,
    };
  }
  const endpoint = resolveSttOnlineProbeUrl(runtime);
  if (!endpoint) {
    return {
      state: "unconfigured",
      available: false,
      message: "未配置在线 STT URL，或所选厂商不支持无 URL 探测。",
    };
  }
  if (!isAllowedSttOnlineEndpoint(endpoint)) {
    return {
      state: "unconfigured",
      available: false,
      endpoint,
      message: INVALID_ENDPOINT_MESSAGE,
    };
  }

  const def = getSttOnlineProviderDefinition(runtime.selectedProviderId);
  const apiKey = getSttOnlineApiKeyFromMemory()?.trim();
  if (!apiKey) {
    return {
      state: "unconfigured",
      available: false,
      endpoint,
      message: "未在内存中设置 API Key（关闭页面后需重新输入）。",
    };
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const ctrl = new AbortController();
  const t = globalThis.setTimeout(() => ctrl.abort(), runtime.timeoutMs);
  const onAbort = () => ctrl.abort();
  if (options.signal) {
    if (options.signal.aborted) ctrl.abort();
    else options.signal.addEventListener("abort", onAbort, { once: true });
  }

  const cleanup = () => {
    globalThis.clearTimeout(t);
    options.signal?.removeEventListener("abort", onAbort);
  };

  if (options.signal?.aborted) {
    cleanup();
    return { state: "aborted", available: false, endpoint, message: "探测已取消。" };
  }

  const started = Date.now();
  try {
    const headers: Record<string, string> = { accept: "application/json" };
    if (def) Object.assign(headers, authHeaderForProbe(def, apiKey));
    else headers.authorization = `Bearer ${apiKey}`;

    const res = await fetchImpl(endpoint, { method: "GET", headers, signal: ctrl.signal });
    const latencyMs = Math.max(0, Date.now() - started);
    if (res.ok) {
      return { state: "available", available: true, endpoint, status: res.status, latencyMs };
    }
    if (res.status === 401) {
      return {
        state: "unauthorized",
        available: false,
        endpoint,
        status: res.status,
        latencyMs,
        message: "密钥被拒绝 (401)。",
      };
    }
    if (res.status === 403) {
      return {
        state: "forbidden",
        available: false,
        endpoint,
        status: res.status,
        latencyMs,
        message: "访问被拒绝 (403)。",
      };
    }
    if (res.status === 405) {
      return {
        state: "available",
        available: true,
        endpoint,
        status: res.status,
        latencyMs,
        message: "端点可达但可能不接受 GET（可改由 Tauri 专用探测）。",
      };
    }
    return {
      state: "http-error",
      available: false,
      endpoint,
      status: res.status,
      latencyMs,
      message: `HTTP ${res.status}`,
    };
  } catch (e) {
    const timedOut = ctrl.signal.aborted && !options.signal?.aborted;
    const isAbort = e instanceof Error && e.name === "AbortError";
    if (options.signal?.aborted || (isAbort && !timedOut)) {
      return { state: "aborted", available: false, endpoint, message: "探测已取消。" };
    }
    if (timedOut) {
      return {
        state: "timeout",
        available: false,
        endpoint,
        message: `探测超时（${runtime.timeoutMs}ms）。`,
      };
    }
    if (e instanceof TypeError) {
      return {
        state: "network-error",
        available: false,
        endpoint,
        message: e.message || "网络错误。",
      };
    }
    return {
      state: "unknown-error",
      available: false,
      endpoint,
      message: e instanceof Error ? e.message : String(e),
    };
  } finally {
    cleanup();
  }
}
