import type { SegmentDto } from "../tauri/projectApi";

/**
 * Packable overlay indices (excludes dominant-span placeholders).
 */
export function selectOverlayRenderedSegmentIndices(input: {
  segments: SegmentDto[];
  dominantSpanIndices?: readonly number[];
}): number[] {
  const dominant = new Set(input.dominantSpanIndices ?? []);
  const out: number[] = [];
  for (let idx = 0; idx < input.segments.length; idx += 1) {
    if (!dominant.has(idx)) out.push(idx);
  }
  return out;
}

/** DOM overlay indices: selected + in-progress draft only (display bands use canvas). */
export function selectOverlayInteractiveSegmentIndices(input: {
  segmentCount: number;
  selectedIdx: number;
  draftIdx: number | null;
}): number[] {
  const out: number[] = [];
  const seen = new Set<number>();
  const add = (idx: number) => {
    if (idx < 0 || idx >= input.segmentCount || seen.has(idx)) return;
    seen.add(idx);
    out.push(idx);
  };
  add(input.selectedIdx);
  if (input.draftIdx != null) add(input.draftIdx);
  return out;
}
