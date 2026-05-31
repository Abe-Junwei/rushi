/** FunASR recognition language preference (R3g-C C4). */

export const LOCAL_ASR_RECOGNITION_LANGUAGE_STORAGE_KEY = "rushi.localAsr.recognitionLanguage";

export type LocalAsrRecognitionLanguage = "zh" | "auto" | "en" | "ja" | "ko" | "yue";

export const DEFAULT_LOCAL_ASR_RECOGNITION_LANGUAGE: LocalAsrRecognitionLanguage = "zh";

export const LOCAL_ASR_RECOGNITION_LANGUAGE_OPTIONS: ReadonlyArray<{
  id: LocalAsrRecognitionLanguage;
  label: string;
  description: string;
}> = [
  { id: "zh", label: "中文", description: "默认；适合中文录音转写。" },
  { id: "auto", label: "自动检测", description: "由 SenseVoice 等模型自动判断语种。" },
  { id: "en", label: "English", description: "英文为主的内容。" },
  { id: "ja", label: "日本語", description: "日文为主的内容。" },
  { id: "ko", label: "한국어", description: "韩文为主的内容。" },
  { id: "yue", label: "粤语", description: "粤语/广东话内容。" },
] as const;

const ALLOWED = new Set<string>(LOCAL_ASR_RECOGNITION_LANGUAGE_OPTIONS.map((o) => o.id));

export function normalizeLocalAsrRecognitionLanguage(
  raw: string | null | undefined,
): LocalAsrRecognitionLanguage {
  const id = (raw ?? "").trim();
  if (ALLOWED.has(id)) return id as LocalAsrRecognitionLanguage;
  return DEFAULT_LOCAL_ASR_RECOGNITION_LANGUAGE;
}

export function readStoredLocalAsrRecognitionLanguage(): LocalAsrRecognitionLanguage {
  try {
    return normalizeLocalAsrRecognitionLanguage(
      localStorage.getItem(LOCAL_ASR_RECOGNITION_LANGUAGE_STORAGE_KEY),
    );
  } catch {
    return DEFAULT_LOCAL_ASR_RECOGNITION_LANGUAGE;
  }
}

export function writeStoredLocalAsrRecognitionLanguage(language: LocalAsrRecognitionLanguage): void {
  try {
    localStorage.setItem(LOCAL_ASR_RECOGNITION_LANGUAGE_STORAGE_KEY, language);
  } catch {
    /* ignore */
  }
}

export function localAsrRecognitionLanguageLabel(
  language: LocalAsrRecognitionLanguage,
): string {
  return (
    LOCAL_ASR_RECOGNITION_LANGUAGE_OPTIONS.find((o) => o.id === language)?.label ?? language
  );
}

/** True when sidecar-reported language (D2) matches UI selection (D1). */
export function sidecarRecognitionLanguageMatchesSelection(
  sidecarLanguage: string | null | undefined,
  selected: LocalAsrRecognitionLanguage,
): boolean {
  const raw = (sidecarLanguage ?? "").trim();
  if (!raw) {
    // No D2 from /health — do not invent a match (R3-STATE).
    return false;
  }
  return normalizeLocalAsrRecognitionLanguage(sidecarLanguage) === selected;
}
