import type { SegmentDto } from "../tauri/projectApi";

/** Normalize segment body text for persist / compare (newlines → space). */
export function normalizeSegmentDraftText(text: string): string {
  return text.replace(/\r\n|\r|\n/g, " ");
}

/** Live segment text after P9b2b: SegmentDto[] is the projection of CM6. */
export function resolveLiveSegmentText(seg: SegmentDto, _idx?: number): string {
  return normalizeSegmentDraftText(seg.text ?? "");
}
