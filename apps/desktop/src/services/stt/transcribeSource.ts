export type TranscribeSource = "local" | "online";

const TRANSCRIBE_SOURCE_SESSION_KEY = "rushi.transcribe.source";
const TRANSCRIBE_SOURCE_USER_OVERRIDE_KEY = "rushi.transcribe.source.userOverride";

export function readStoredTranscribeSource(): TranscribeSource {
  if (typeof sessionStorage === "undefined") return "local";
  return sessionStorage.getItem(TRANSCRIBE_SOURCE_SESSION_KEY) === "online" ? "online" : "local";
}

export function persistTranscribeSource(source: TranscribeSource): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(TRANSCRIBE_SOURCE_SESSION_KEY, source);
}

/** 用户在自动转录对话框里显式选择的来源；未设置时允许在线就绪后自动切到 online。 */
export function readTranscribeSourceUserOverride(): TranscribeSource | null {
  if (typeof sessionStorage === "undefined") return null;
  const v = sessionStorage.getItem(TRANSCRIBE_SOURCE_USER_OVERRIDE_KEY);
  return v === "online" || v === "local" ? v : null;
}

export function persistTranscribeSourceUserOverride(source: TranscribeSource): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(TRANSCRIBE_SOURCE_USER_OVERRIDE_KEY, source);
}

export function clearTranscribeSourceUserOverride(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(TRANSCRIBE_SOURCE_USER_OVERRIDE_KEY);
}
