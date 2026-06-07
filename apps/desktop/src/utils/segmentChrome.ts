import type { SegmentDto } from "../tauri/projectApi";
import { COLORS } from "../config/tokens";

/** 白底波形条上的 region 填充（编辑页 indigo 选中高亮；未选中刻意压低以拉开对比） */
export function waveformRegionFillColor(seg: SegmentDto, selected: boolean, inSelection = false): string {
  if (selected) return `color-mix(in srgb, ${COLORS.indigo} 26%, transparent)`;
  if (inSelection) return `color-mix(in srgb, ${COLORS.indigo} 14%, transparent)`;
  if (seg.low_confidence) return `color-mix(in srgb, ${COLORS.waveformRegionLaneLow} 22%, transparent)`;
  return `color-mix(in srgb, ${COLORS.ink} 6%, transparent)`;
}

/** WaveSurfer region `color`（语段卡/非白底语境；DESIGN 近单色 + ink 选中） */
export function p1RegionFillColor(seg: SegmentDto, selected: boolean): string {
  if (selected) return `color-mix(in srgb, ${COLORS.ink} 32%, transparent)`;
  if (seg.low_confidence) return `color-mix(in srgb, ${COLORS.warning} 22%, transparent)`;
  return `color-mix(in srgb, ${COLORS.waveformRegionLaneLow} 22%, transparent)`;
}

/** 时间轨语段卡片：可编辑内容板与时长底色分离，避免长条直接变成整块编辑面。 */
export function segmentCardChrome(
  seg: SegmentDto,
  selected: boolean,
): { slabBg: string; slabBorder: string; railFill: string; railAccent: string; outerShadow: string } {
  if (selected && seg.low_confidence) {
    return {
      slabBg: "bg-amber-50/95",
      slabBorder: "border border-zen-saffron/45",
      railFill: "bg-amber-300/20",
      railAccent: "bg-zen-saffron/85",
      outerShadow: "shadow-[inset_0_0_0_1px_var(--notion-border)]",
    };
  }
  if (selected) {
    return {
      slabBg: "bg-zen-ochre/95",
      slabBorder: "border border-zen-saffron/40",
      railFill: "bg-zen-saffron/16",
      railAccent: "bg-zen-saffron/78",
      outerShadow: "shadow-[inset_0_0_0_1px_var(--notion-border)]",
    };
  }
  if (seg.low_confidence) {
    return {
      slabBg: "bg-amber-50/92",
      slabBorder: "border border-amber-200",
      railFill: "bg-amber-300/18",
      railAccent: "bg-amber-400/78",
      outerShadow: "shadow-none",
    };
  }
  return {
    slabBg: "bg-zen-paper/96",
    slabBorder: "border border-notion-border",
    railFill: "bg-zen-ink/6",
    railAccent: "bg-zen-indigo/32",
    outerShadow: "shadow-none",
  };
}
