export type SttOnlineAuthStyle = "bearer" | "header";

/** 与解语 acoustic 定义表「国内 / 国际」分组展示一致 */
export type SttOnlineMarket = "china" | "global";

export interface SttOnlineProviderCapability {
  batchRest: boolean;
  streaming: boolean;
  asyncJob: boolean;
  /** 厂商是否常提供分句级时间戳（或可由词级拼出） */
  segmentTimestamps: boolean;
  /** 厂商是否常提供词级时间戳 */
  wordTimestamps?: boolean;
}

export interface SttOnlineProviderDefinition {
  id: string;
  label: string;
  description: string;
  /** 文档入口，便于环境 → 本机 ASR 面板外链 */
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
  /** 根凭证输入框下的说明（避免与同类云产品混淆） */
  credentialHint?: string;
  /** 根凭证 placeholder */
  credentialPlaceholder?: string;
  /**
   * @deprecated 转写 URL 已迁至 `presetEndpoints.ts` 预置；仅 custom-proxy 需用户填写。
   * 保留字段供旧文档引用，勿再用于 UI 占位。
   */
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
  /** 本地受保护存储中的 API Key 引用（不含明文） */
  apiKeyId?: string;
  timeoutMs: number;
}

export type ExternalSttOnlineHealthState =
  | "available"
  | "disabled"
  | "unconfigured"
  | "aborted"
  | "unauthorized"
  | "forbidden"
  | "method-not-allowed"
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

/** 与 Tauri `stt_native::dispatch_native` 的 `native_adapter` 一致（壳内直连）。 */
export type OnlineNativeAdapterId =
  | "openaiAudio"
  | "assemblyai"
  | "deepgramListen"
  | "dashscopeAsr";

/** 供 Tauri `project_run_transcribe` 的 `online` 参数；与 Rust `OnlineTranscribeBridge` 字段 camelCase 对齐。 */
export type OnlineTranscribeBridgePayload = {
  transcribeUrl: string;
  authorization?: string | null;
  timeoutSec?: number | null;
  /** 非空时 Rust 走厂商原生 API，再归一为 Rushi `TranscriptionResult` JSON。 */
  nativeAdapter?: OnlineNativeAdapterId | null;
  /** 应用级标识（AppKey 等），由自建网关读取请求头 `X-Rushi-Stt-App-Key`（若设置）。 */
  appKey?: string | null;
};
