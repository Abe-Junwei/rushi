/**
 * 讯飞 speedTranscription `business.accent`。
 *
 * 官方文档（speedTranscription/API.html）`business.accent` 取值范围仅 `mandarin`；
 * 中英 + 202 种方言为「免切识别」（`language=zh_cn` 下自动检测，无需切 accent）。
 * 故 v1 收敛为单一 `mandarin`，不暴露会触发参数错误（10303）的方言码。
 */
export const XUNFEI_SPEED_ASR_ACCENT_PRESETS = [
  { value: "mandarin", label: "普通话" },
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
