import type { SegmentDto } from "../tauri/projectApi";

/** Canvas 2D 不解析 CSS color-mix()；与 tokens COLORS.indigo (#3D4F5D) 对齐。 */
const INDIGO_RGB = "61, 79, 93";

/** Canvas fill for segment bands (matches waveformRegionFillColor intent). */
export function segmentBandFillStyle(seg: SegmentDto, selected: boolean): string {
  if (selected) return `rgba(${INDIGO_RGB}, 0.15)`;
  if (seg.low_confidence) return "rgba(156, 163, 175, 0.28)";
  return "rgba(44, 44, 44, 0.12)";
}

export const SEGMENT_BAND_BORDER_COLOR = `rgba(44, 44, 44, 0.16)`;
export const SEGMENT_BAND_BORDER_SELECTED_COLOR = `rgba(${INDIGO_RGB}, 0.3)`;
