import type { SegmentListFilterNavState } from "./segmentListFilterNav";
import { readSegmentListFilterNavIndices } from "./segmentListFilterNav";
import {
  querySegmentListScrollRoot,
  readSegmentListFilterIndices,
} from "./segmentListVirtualWindow";
import { effectiveTranscriptPrimaryIdx } from "../components/editor/core/projectionWaveformBridge";

/** ↑↓ anchor: CM6 projection primary, else React SC1 bridge. */
export function resolveListSelectionNavAnchor(fallbackIdx: number): number {
  return effectiveTranscriptPrimaryIdx(fallbackIdx);
}

/** Resolve ↑↓ target within the visible segment list (respects active filter). */
export function resolveAdjacentVisibleSegmentIdx(
  segmentIdx: number,
  direction: -1 | 1,
  segmentCount: number,
  filteredIndices: readonly number[] | null,
): number | null {
  if (segmentCount <= 0 || segmentIdx < 0) return null;

  if (filteredIndices === null) {
    const next = segmentIdx + direction;
    return next >= 0 && next < segmentCount ? next : null;
  }

  if (filteredIndices.length === 0) return null;

  const pos = filteredIndices.indexOf(segmentIdx);
  if (pos < 0) {
    if (direction > 0) {
      for (const idx of filteredIndices) {
        if (idx > segmentIdx) return idx;
      }
      return null;
    }
    for (let i = filteredIndices.length - 1; i >= 0; i -= 1) {
      const idx = filteredIndices[i];
      if (idx < segmentIdx) return idx;
    }
    return null;
  }

  const nextPos = pos + direction;
  if (nextPos < 0 || nextPos >= filteredIndices.length) return null;
  return filteredIndices[nextPos] ?? null;
}

/** Global ↑↓ shortcut target (filter ref 优先，DOM attr 兜底)。 */
export function resolveKeyboardAdvanceTarget(
  selectedIdx: number,
  direction: -1 | 1,
  segmentCount: number,
  filterState?: SegmentListFilterNavState,
): number | null {
  const filtered = filterState
    ? readSegmentListFilterNavIndices(filterState, segmentCount)
    : readSegmentListFilterIndices(querySegmentListScrollRoot());
  return resolveAdjacentVisibleSegmentIdx(selectedIdx, direction, segmentCount, filtered);
}
