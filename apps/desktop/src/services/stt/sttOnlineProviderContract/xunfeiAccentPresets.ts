/** 讯飞 speedTranscription `business.accent` v1 preset（Grill 2026-06-18 定稿）。 */
export const XUNFEI_SPEED_ASR_ACCENT_PRESETS = [
  { value: "mandarin", label: "普通话" },
  { value: "cantonese", label: "粤语" },
  { value: "lmz", label: "四川话" },
  { value: "henanese", label: "河南话" },
  { value: "dongbeiese", label: "东北话" },
  { value: "shanghainese", label: "上海话" },
  { value: "minnanese", label: "闽南话" },
  { value: "uighur", label: "维语" },
] as const;

export type XunfeiSpeedAsrAccent = (typeof XUNFEI_SPEED_ASR_ACCENT_PRESETS)[number]["value"];

export const DEFAULT_XUNFEI_SPEED_ASR_ACCENT: XunfeiSpeedAsrAccent = "mandarin";

export function normalizeXunfeiSpeedAsrAccent(raw: string | null | undefined): XunfeiSpeedAsrAccent {
  const t = raw?.trim();
  if (t && XUNFEI_SPEED_ASR_ACCENT_PRESETS.some((p) => p.value === t)) {
    return t as XunfeiSpeedAsrAccent;
  }
  return DEFAULT_XUNFEI_SPEED_ASR_ACCENT;
}
