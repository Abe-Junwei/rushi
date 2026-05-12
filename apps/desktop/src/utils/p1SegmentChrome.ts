import type { SegmentDto } from "../tauri/p1Api";

/** 白底波形条上的 region 填充（灰阶语义；与下方语段卡配色分离） */
export function p1WaveformRegionFillColor(seg: SegmentDto, selected: boolean): string {
  if (selected) return "color-mix(in srgb, #4a4a4a 28%, transparent)";
  if (seg.low_confidence) return "color-mix(in srgb, #9a9a9a 32%, transparent)";
  return "color-mix(in srgb, #b0b0b0 22%, transparent)";
}

/** WaveSurfer region `color`（语段卡/非白底语境；与解语 primary / 低置信 / 默认 语义对齐） */
export function p1RegionFillColor(seg: SegmentDto, selected: boolean): string {
  if (selected) return "color-mix(in srgb, #C58A43 38%, transparent)";
  if (seg.low_confidence) return "color-mix(in srgb, #EAE0C5 45%, transparent)";
  return "color-mix(in srgb, #8E8E8E 22%, transparent)";
}

/** 时间轨语段卡片：背景 + ring（Tailwind class 片段） */
export function p1SegmentCardChrome(seg: SegmentDto, selected: boolean): { cardBg: string; cardRing: string } {
  const cardBg = seg.low_confidence
    ? "bg-zen-ochre/50"
    : selected
      ? "bg-zen-saffron/25"
      : "bg-zen-paper/90";
  const cardRing = selected ? "ring-zen-saffron/45" : "ring-black/[0.08]";
  return { cardBg, cardRing };
}
