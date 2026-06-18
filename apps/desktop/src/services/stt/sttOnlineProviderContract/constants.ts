export const STT_ONLINE_PROVIDER_STORAGE_KEYS = {
  enabled: "rushi.stt.online.enabled",
  selectedProviderId: "rushi.stt.online.selectedProviderId",
  endpoint: "rushi.stt.online.endpoint",
  appKey: "rushi.stt.online.appKey",
  timeoutMs: "rushi.stt.online.timeoutMs",
  apiKeyId: "rushi.stt.online.apiKeyId",
  apiSecretId: "rushi.stt.online.apiSecretId",
  accent: "rushi.stt.online.accent",
  connectionVerifiedFingerprint: "rushi.stt.online.connectionVerifiedFingerprint",
} as const;

/** OpenAI Audio Transcriptions；未填 endpoint 时 Tauri 走此默认。 */
export const STT_ONLINE_OPENAI_DEFAULT_TRANSCRIBE_URL = "https://api.openai.com/v1/audio/transcriptions";

/** AssemblyAI API 根；未填 endpoint 时 Tauri 使用 `${base}/v2/upload` 等。 */
export const STT_ONLINE_ASSEMBLYAI_DEFAULT_BASE_URL = "https://api.assemblyai.com";

export const STT_ONLINE_OPENAI_DEFAULT_PROBE_URL = "https://api.openai.com/v1/models";
/** GET 列表；`/v2/upload` 仅 POST，探测会误报 405。 */
export const STT_ONLINE_ASSEMBLYAI_DEFAULT_PROBE_URL = "https://api.assemblyai.com/v2/transcript";
export const STT_ONLINE_DEEPGRAM_DEFAULT_PROBE_URL = "https://api.deepgram.com/v1/projects";

/** 百炼 Fun-ASR 录音文件异步转写（临时 OSS + Job；术语热词 vocabulary_id）。 */
export const STT_ONLINE_DASHSCOPE_DEFAULT_TRANSCRIBE_URL =
  "https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription";
export const STT_ONLINE_DASHSCOPE_DEFAULT_PROBE_URL =
  "https://dashscope.aliyuncs.com/compatible-mode/v1/models";

/** 讯飞 OST 任务 API（探测为 credentials-only；展示用）。 */
export const STT_ONLINE_XUNFEI_SPEED_ASR_DEFAULT_TRANSCRIBE_URL =
  "https://ost-api.xfyun.cn/v2/ost/pro_create";

export const DEFAULT_TIMEOUT_MS = 30_000;

/** 设置页「探测连接」上限（与长音频转写 Job 超时解耦）。 */
export const STT_ONLINE_PROBE_TIMEOUT_MS_MAX = 120_000;

export function capSttOnlineProbeTimeoutMs(ms: number): number {
  if (!Number.isFinite(ms) || ms <= 0) return STT_ONLINE_PROBE_TIMEOUT_MS_MAX;
  return Math.max(3_000, Math.min(STT_ONLINE_PROBE_TIMEOUT_MS_MAX, Math.round(ms)));
}
