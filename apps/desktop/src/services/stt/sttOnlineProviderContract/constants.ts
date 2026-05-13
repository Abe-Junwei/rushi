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

export const STT_ONLINE_OPENAI_DEFAULT_PROBE_URL = "https://api.openai.com/v1/models";
export const STT_ONLINE_ASSEMBLYAI_DEFAULT_PROBE_URL = "https://api.assemblyai.com/v2/upload";

export const DEFAULT_TIMEOUT_MS = 30_000;
