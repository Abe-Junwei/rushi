export const MAX_DOM_OVERLAY_SPARSE = 32;

export type WaveformSelectionRenderProjection = {
  overlayInteractiveIndices: number[];
  canvasSkipIndexSet: ReadonlySet<number>;
  fallbackTargetIdx: number | null;
};

function resolveOverlaySelectionRange(input: {
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

function addCappedContiguousRange(
  add: (idx: number) => void,
  lo: number,
  hi: number,
  primaryIdx: number,
): void {
  const span = hi - lo + 1;
  if (span <= MAX_DOM_OVERLAY_SPARSE) {
    for (let idx = lo; idx <= hi; idx += 1) add(idx);
    return;
  }
  add(primaryIdx);
  add(lo);
  add(hi);
}

export function selectWaveformOverlayInteractiveIndices(input: {
  segmentCount: number;
  selectedIdx: number;
  selectedIndices?: ReadonlySet<number>;
  selectionLo?: number;
  selectionHi?: number;
  selectionCount?: number;
  isContiguousSelection?: boolean;
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

  if (input.selectedIndices && input.selectedIndices.size > 0) {
    if (input.selectedIndices.size <= MAX_DOM_OVERLAY_SPARSE) {
      for (const idx of input.selectedIndices) add(idx);
    } else {
      add(input.selectedIdx);
      const sorted = [...input.selectedIndices].sort((a, b) => a - b);
      add(sorted[0]);
      add(sorted[sorted.length - 1]);
      add(lo);
      add(hi);
    }
  }

  const fillContiguousRange =
    input.isContiguousSelection === true &&
    (input.selectionCount ?? 0) > 1 &&
    hi > lo;

  if (fillContiguousRange) {
    addCappedContiguousRange(add, lo, hi, input.selectedIdx);
  } else if (!input.selectedIndices || input.selectedIndices.size === 0) {
    addCappedContiguousRange(add, lo, hi, input.selectedIdx);
  }

  if (input.draftIdx != null) add(input.draftIdx);
  return out;
}

function overlaySegmentDomNode(root: ParentNode, idx: number): boolean {
  return Boolean(root.querySelector(`[data-segment-idx="${idx}"]`));
}

export function resolveWaveformSelectionRenderProjection(input: {
  segmentCount: number;
  selectedIdx: number;
  selectedIndices?: ReadonlySet<number>;
  selectionLo?: number;
  selectionHi?: number;
  selectionCount?: number;
  isContiguousSelection?: boolean;
  draftIdx: number | null;
  overlayRoot?: ParentNode | null;
}): WaveformSelectionRenderProjection {
  const overlayInteractiveIndices = selectWaveformOverlayInteractiveIndices(input);
  const canvasSkipIndexSet = new Set(overlayInteractiveIndices);
  const root = input.overlayRoot;
  let fallbackTargetIdx: number | null = null;

  if (input.selectedIdx >= 0) {
    if (root && overlaySegmentDomNode(root, input.selectedIdx)) {
      canvasSkipIndexSet.add(input.selectedIdx);
    } else {
      canvasSkipIndexSet.delete(input.selectedIdx);
      fallbackTargetIdx = input.selectedIdx;
    }
  }
  if (input.draftIdx != null && input.draftIdx >= 0) {
    if (!root || !overlaySegmentDomNode(root, input.draftIdx)) {
      canvasSkipIndexSet.delete(input.draftIdx);
      fallbackTargetIdx = input.draftIdx;
    }
  }

  return {
    overlayInteractiveIndices,
    canvasSkipIndexSet,
    fallbackTargetIdx,
  };
}
