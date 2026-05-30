import type { SegmentDto } from "../tauri/projectApi";
import { visibleTimeWindowFromScroll } from "./waveformProjection";

const DEFAULT_PADDING_SEC = 2;

/** Indices of segments intersecting the visible tier window (+ selected, padded). */
export function pickVisibleSegmentIndices(input: {
  segments: SegmentDto[];
  durationSec: number;
  timelineWidthPx: number;
  scrollLeftPx: number;
  viewportWidthPx: number;
  selectedIdx: number;
  paddingSec?: number;
}): number[] {
  const { segments, durationSec, timelineWidthPx, scrollLeftPx, viewportWidthPx, selectedIdx } =
    input;
  const pad = input.paddingSec ?? DEFAULT_PADDING_SEC;
  if (segments.length === 0 || durationSec <= 0) return [];
  if (timelineWidthPx <= 0) return segments.map((_, idx) => idx);

  const view = visibleTimeWindowFromScroll({
    scrollLeftPx,
    viewportWidthPx,
    timelineWidthPx,
    durationSec,
  });
  if (!view) return segments.map((_, idx) => idx);

  const start = Math.max(0, view.start - pad);
  const end = view.end + pad;
  const picked = new Set<number>();
  if (selectedIdx >= 0 && selectedIdx < segments.length) {
    picked.add(selectedIdx);
  }
  segments.forEach((seg, idx) => {
    if (seg.end_sec >= start && seg.start_sec <= end) {
      picked.add(idx);
    }
  });
  return [...picked].sort((a, b) => a - b);
}
