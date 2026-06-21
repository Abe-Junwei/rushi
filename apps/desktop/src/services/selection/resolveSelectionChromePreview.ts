import type { TranscriptionLayerInput } from "../../pages/transcriptionLayerTypes";
import {
  normalizeSegmentIndexRange,
  rangeIndices,
  resolveSegmentSelectionAnchor,
  toggleSegmentIndex,
} from "../../utils/segmentSelection";

/** 与 useSegmentSelectionController.selectSegmentAt 同步预览下一帧 SC2/SC3（shift/toggle 近似 anchor）。 */
export function resolveSelectionChromePreview(
  ctx: TranscriptionLayerInput,
  idx: number,
  opts?: { shiftKey?: boolean; toggle?: boolean },
): { primaryIdx: number; selectedSet: Set<number> } {
  const segmentCount = ctx.segments.length;
  if (segmentCount <= 0 || idx < 0 || idx >= segmentCount) {
    return { primaryIdx: -1, selectedSet: new Set() };
  }

  const currentSet = new Set(ctx.selectedIndicesArray);

  if (opts?.toggle) {
    const toggled = toggleSegmentIndex(currentSet, ctx.selectedIdx, idx);
    if (!toggled) {
      return { primaryIdx: 0, selectedSet: new Set([0]) };
    }
    return { primaryIdx: toggled.primaryIdx, selectedSet: toggled.indices };
  }

  if (opts?.shiftKey) {
    const anchor = resolveSegmentSelectionAnchor(
      ctx.selectionRangeAnchorIdx,
      ctx.selectedIdx,
      idx,
    );
    const normalized = normalizeSegmentIndexRange(anchor, idx, segmentCount);
    if (!normalized) {
      return { primaryIdx: idx, selectedSet: new Set([idx]) };
    }
    return {
      primaryIdx: idx,
      selectedSet: rangeIndices(normalized.lo, normalized.hi),
    };
  }

  return { primaryIdx: idx, selectedSet: new Set([idx]) };
}
