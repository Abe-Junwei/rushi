import type { SegmentDto } from "../tauri/projectApi";
import {
  clampSegmentTimeBounds,
  isPlaceholderSegment,
  WAVEFORM_DOMINANT_SPAN_RATIO,
} from "./waveformSegmentBounds";

export { WAVEFORM_DOMINANT_SPAN_RATIO };

export type SanitizeSegmentsResult = {
  segments: SegmentDto[];
  removedDominantCount: number;
};

/** Clamp bounds to media duration; optionally drop whole-track placeholders when normal segments exist. */
export function sanitizeSegmentsForMedia(
  segments: SegmentDto[],
  mediaDurationSec: number,
  filterDominantWhenRedundant = true,
): SanitizeSegmentsResult {
  const dur = mediaDurationSec > 0 ? mediaDurationSec : 0;
  const clamped = segments.map((s) => {
    if (dur <= 0) return { ...s };
    const bounds = clampSegmentTimeBounds(s.start_sec, s.end_sec, dur);
    return { ...s, start_sec: bounds.startSec, end_sec: bounds.endSec };
  });

  if (!filterDominantWhenRedundant || dur <= 0 || clamped.length <= 1) {
    return { segments: reindexSegments(clamped), removedDominantCount: 0 };
  }

  const nonDominantCount = clamped.filter((s) => !isPlaceholderSegment(s, dur)).length;
  if (nonDominantCount === 0) {
    return { segments: reindexSegments(clamped), removedDominantCount: 0 };
  }

  const before = clamped.length;
  const kept = clamped.filter((s) => !isPlaceholderSegment(s, dur));
  return {
    segments: reindexSegments(kept),
    removedDominantCount: before - kept.length,
  };
}

function reindexSegments(segments: SegmentDto[]): SegmentDto[] {
  return segments.map((s, idx) => ({ ...s, idx }));
}

/** Parse backend warning `segments_dominant_span_filtered:N`. */
export function parseDominantSpanFilteredCount(warnings: string[]): number {
  for (const w of warnings) {
    const prefix = "segments_dominant_span_filtered:";
    if (!w.startsWith(prefix)) continue;
    const n = Number.parseInt(w.slice(prefix.length), 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}
