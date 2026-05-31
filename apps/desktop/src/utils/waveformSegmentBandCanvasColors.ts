import type { SegmentDto } from "../tauri/projectApi";

/** Canvas fill for segment bands (matches waveformRegionFillColor intent). */
export function segmentBandFillStyle(seg: SegmentDto, selected: boolean): string {
  if (selected) return "rgba(197, 138, 67, 0.18)";
  if (seg.low_confidence) return "rgba(156, 163, 175, 0.28)";
  return "rgba(44, 44, 44, 0.12)";
}

export const SEGMENT_BAND_BORDER_COLOR = `rgba(44, 44, 44, 0.16)`;
export const SEGMENT_BAND_BORDER_SELECTED_COLOR = `rgba(197, 138, 67, 0.55)`;
