/** Helpers for selection-only dirty-rect updates of the segment band canvas. */

export function expandSegmentBandDirtyIndices(
  indices: readonly number[],
  segmentCount: number,
): number[] {
  const expanded = new Set<number>();
  for (const idx of indices) {
    if (!Number.isFinite(idx) || idx < 0 || idx >= segmentCount) continue;
    expanded.add(idx);
    if (idx > 0) expanded.add(idx - 1);
    if (idx + 1 < segmentCount) expanded.add(idx + 1);
  }
  return [...expanded].sort((a, b) => a - b);
}

/**
 * Build a small dirty index list for primary/range selection changes.
 * Returns null when the selection span is too large for dirty-rect painting.
 */
export function collectSegmentBandSelectionDirtyIndices(input: {
  previousPrimaryIdx: number;
  nextPrimaryIdx: number;
  previousLo?: number;
  previousHi?: number;
  previousCount?: number;
  nextLo?: number;
  nextHi?: number;
  nextCount?: number;
  segmentCount: number;
}): number[] | null {
  const dirty = new Set<number>();

  const addRange = (
    lo: number | undefined,
    hi: number | undefined,
    count: number | undefined,
  ): boolean => {
    if (count == null || count <= 0 || lo == null || hi == null) return true;
    // Inclusive span size must stay small enough for dirty-rect painting.
    if (count > 8 || hi - lo + 1 > 8) return false;
    for (let i = lo; i <= hi; i += 1) dirty.add(i);
    return true;
  };

  if (input.previousPrimaryIdx >= 0) dirty.add(input.previousPrimaryIdx);
  if (input.nextPrimaryIdx >= 0) dirty.add(input.nextPrimaryIdx);

  if (!addRange(input.previousLo, input.previousHi, input.previousCount)) return null;
  if (!addRange(input.nextLo, input.nextHi, input.nextCount)) return null;

  return expandSegmentBandDirtyIndices([...dirty], input.segmentCount);
}
