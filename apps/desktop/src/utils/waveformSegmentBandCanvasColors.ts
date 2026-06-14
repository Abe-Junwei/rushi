import type { SegmentDto } from "../tauri/projectApi";

/** Canvas 2D 不解析 CSS color-mix()；与 tokens COLORS.indigo (#3D4F5D) 对齐。 */
const INDIGO_RGB = "61, 79, 93";

/** Canvas fill for segment bands (matches waveformRegionFillColor intent). */
export function segmentBandFillStyle(seg: SegmentDto, selected: boolean): string {
  if (selected) return `rgba(${INDIGO_RGB}, 0.26)`;
  if (seg.low_confidence) return "rgba(156, 163, 175, 0.22)";
  return "rgba(44, 44, 44, 0.06)";
}

export const SEGMENT_BAND_BORDER_COLOR = `rgba(44, 44, 44, 0.10)`;
