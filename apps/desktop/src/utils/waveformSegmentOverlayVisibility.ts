import type { SegmentDto } from "../tauri/projectApi";

export function resolveOverlaySelectionRange(input: {
  segmentCount: number;
  selectedIdx: number;
  selectionLo?: number;
  selectionHi?: number;
}): { lo: number; hi: number } {
  if (input.segmentCount <= 0) return { lo: 0, hi: 0 };
  const rawLo = input.selectionLo ?? input.selectedIdx;
  const rawHi = input.selectionHi ?? input.selectedIdx;
  const lo = Math.max(0, Math.min(rawLo, rawHi, input.segmentCount - 1));
  const hi = Math.min(input.segmentCount - 1, Math.max(rawLo, rawHi));
  return { lo, hi };
}

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

/** DOM overlay indices: selected range + in-progress draft only (display bands use canvas). */
export function selectOverlayInteractiveSegmentIndices(input: {
  segmentCount: number;
  selectedIdx: number;
  selectionLo?: number;
  selectionHi?: number;
  draftIdx: number | null;
}): number[] {
  const out: number[] = [];
  const seen = new Set<number>();
  const add = (idx: number) => {
    if (idx < 0 || idx >= input.segmentCount || seen.has(idx)) return;
    seen.add(idx);
    out.push(idx);
  };
  const { lo, hi } = resolveOverlaySelectionRange(input);
  for (let idx = lo; idx <= hi; idx += 1) add(idx);
  if (input.draftIdx != null) add(input.draftIdx);
  return out;
}
