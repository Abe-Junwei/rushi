import type { SegmentDto } from "../tauri/projectApi";
import { COLORS } from "../config/tokens";

/** 白底波形条上的 region 填充（编辑页 indigo 选中高亮；未选中刻意压低以拉开对比） */
export function waveformRegionFillColor(seg: SegmentDto, selected: boolean, inSelection = false): string {
  if (selected) return `color-mix(in srgb, ${COLORS.indigo} 26%, transparent)`;
  if (inSelection) return `color-mix(in srgb, ${COLORS.indigo} 26%, transparent)`;
  if (seg.low_confidence) return `color-mix(in srgb, ${COLORS.waveformRegionLaneLow} 22%, transparent)`;
  return `color-mix(in srgb, ${COLORS.ink} 6%, transparent)`;
}
