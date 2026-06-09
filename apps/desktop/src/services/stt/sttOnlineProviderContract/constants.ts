export const STT_ONLINE_PROVIDER_STORAGE_KEYS = {
  enabled: "rushi.stt.online.enabled",
  selectedProviderId: "rushi.stt.online.selectedProviderId",
  endpoint: "rushi.stt.online.endpoint",
  appKey: "rushi.stt.online.appKey",
  timeoutMs: "rushi.stt.online.timeoutMs",
  apiKeyId: "rushi.stt.online.apiKeyId",
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

/** 百炼 Fun-ASR Realtime（multimodal-generation + 术语热词 vocabulary_id）。 */
export const STT_ONLINE_DASHSCOPE_DEFAULT_TRANSCRIBE_URL =
  "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation";
export const STT_ONLINE_DASHSCOPE_DEFAULT_PROBE_URL =
  "https://dashscope.aliyuncs.com/compatible-mode/v1/models";

export const DEFAULT_TIMEOUT_MS = 30_000;
