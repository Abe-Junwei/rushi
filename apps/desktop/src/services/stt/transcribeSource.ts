export type TranscribeSource = "local" | "online";

const TRANSCRIBE_SOURCE_SESSION_KEY = "rushi.transcribe.source";

export function readStoredTranscribeSource(): TranscribeSource {
  if (typeof sessionStorage === "undefined") return "local";
  return sessionStorage.getItem(TRANSCRIBE_SOURCE_SESSION_KEY) === "online" ? "online" : "local";
}

export function persistTranscribeSource(source: TranscribeSource): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(TRANSCRIBE_SOURCE_SESSION_KEY, source);
}
