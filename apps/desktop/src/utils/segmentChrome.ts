import type { SegmentDto } from "../tauri/projectApi";
import { COLORS } from "../config/tokens";

/** 白底波形条上的 region 填充（灰阶语义；与下方语段卡配色分离） */
export function waveformRegionFillColor(seg: SegmentDto, selected: boolean): string {
  if (selected) return `color-mix(in srgb, ${COLORS.ink} 26%, transparent)`;
  if (seg.low_confidence) return `color-mix(in srgb, ${COLORS.waveformRegionLaneLow} 32%, transparent)`;
  return `color-mix(in srgb, ${COLORS.waveformRegionLaneIdle} 22%, transparent)`;
}

/** WaveSurfer region `color`（语段卡/非白底语境；DESIGN 近单色 + ink 选中） */
export function p1RegionFillColor(seg: SegmentDto, selected: boolean): string {
  if (selected) return `color-mix(in srgb, ${COLORS.ink} 32%, transparent)`;
  if (seg.low_confidence) return `color-mix(in srgb, ${COLORS.warning} 22%, transparent)`;
  return `color-mix(in srgb, ${COLORS.waveformRegionLaneLow} 22%, transparent)`;
}

/** 时间轨语段卡片：背景 + 边框（不用 ring，避免与内嵌 input 叠出假阴影） */
export function segmentCardChrome(seg: SegmentDto, selected: boolean): { cardBg: string; cardRing: string } {
  const cardBg = seg.low_confidence
    ? "bg-amber-50"
    : selected
      ? "bg-zen-ochre"
      : "bg-zen-paper";
  const cardRing = selected ? "border border-zen-gray-300" : "border border-black/[0.06]";
  return { cardBg, cardRing };
}
