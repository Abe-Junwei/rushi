import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  clampSegmentIndex,
  isContiguousIndexSelection,
  normalizeSegmentIndexRange,
  rangeIndices,
  resolveSegmentSelectionAnchor,
  selectionEnvelope,
  toggleSegmentIndex,
} from "../utils/segmentSelection";

type Args = {
  selectedIdx: number;
  setSelectedIdx: React.Dispatch<React.SetStateAction<number>>;
  segmentCount: number;
  resetKey: string | null;
  disabled?: boolean;
};

function singleSelection(idx: number): Set<number> {
  return new Set([idx]);
}

export function useSegmentSelectionController(args: Args) {
  const { selectedIdx, setSelectedIdx, segmentCount, resetKey, disabled = false } = args;
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(() => new Set());
  const [rangeAnchorIdx, setRangeAnchorIdx] = useState(0);
  const selectedIndicesRef = useRef(selectedIndices);
  selectedIndicesRef.current = selectedIndices;

  useEffect(() => {
    setSelectedIndices(new Set());
    setRangeAnchorIdx(0);
  }, [resetKey]);

  useEffect(() => {
    if (segmentCount <= 0) setSelectedIndices(new Set());
  }, [segmentCount]);

  useEffect(() => {
    if (segmentCount <= 0) return;
    const clamped = clampSegmentIndex(selectedIdx, segmentCount);
    const prev = selectedIndicesRef.current;
    if (prev.has(clamped) && prev.size > 1) return;
    setSelectedIndices(singleSelection(clamped));
    setRangeAnchorIdx(clamped);
  }, [selectedIdx, segmentCount]);

  const envelope = useMemo(() => selectionEnvelope(selectedIndices), [selectedIndices]);

  const applyIndices = useCallback(
    (indices: Set<number>, primaryIdx: number, nextAnchor?: number) => {
      if (segmentCount <= 0 || indices.size === 0) return;
      const primary = clampSegmentIndex(primaryIdx, segmentCount);
      setSelectedIndices(indices);
      if (nextAnchor != null) setRangeAnchorIdx(nextAnchor);
      setSelectedIdx(primary);
    },
    [segmentCount, setSelectedIdx],
  );

  const collapseTo = useCallback(
    (idx: number) => {
      if (segmentCount <= 0) {
        setSelectedIndices(new Set());
        return;
      }
      const clamped = clampSegmentIndex(idx, segmentCount);
      setSelectedIndices(singleSelection(clamped));
      setRangeAnchorIdx(clamped);
    },
    [segmentCount],
  );

  const clearMultiSelection = useCallback(() => {
    if (segmentCount <= 0 || selectedIndices.size <= 1) return;
    collapseTo(clampSegmentIndex(selectedIdx, segmentCount));
  }, [collapseTo, segmentCount, selectedIdx, selectedIndices.size]);

  const selectSegmentAt = useCallback(
    (idx: number, opts?: { shiftKey?: boolean; toggle?: boolean }) => {
      if (disabled || idx < 0 || idx >= segmentCount) return;
      if (opts?.toggle) {
        const toggled = toggleSegmentIndex(selectedIndices, selectedIdx, idx);
        if (!toggled) {
          if (segmentCount <= 0) {
            setSelectedIndices(new Set());
            return;
          }
          setSelectedIndices(singleSelection(0));
          setRangeAnchorIdx(0);
          setSelectedIdx(0);
          return;
        }
        applyIndices(toggled.indices, toggled.primaryIdx);
        if (toggled.indices.size === 1) setRangeAnchorIdx(toggled.primaryIdx);
        return;
      }
      if (opts?.shiftKey) {
        const anchor = resolveSegmentSelectionAnchor(rangeAnchorIdx, selectedIdx, idx);
        const normalized = normalizeSegmentIndexRange(anchor, idx, segmentCount);
        if (!normalized) return;
        applyIndices(rangeIndices(normalized.lo, normalized.hi), idx, anchor);
        return;
      }
      setSelectedIndices(singleSelection(idx));
      setRangeAnchorIdx(idx);
      setSelectedIdx(idx);
    },
    [
      applyIndices,
      disabled,
      rangeAnchorIdx,
      segmentCount,
      selectedIdx,
      selectedIndices,
      setSelectedIdx,
    ],
  );

  const selectSegmentRange = useCallback(
    (lo: number, hi: number) => {
      if (disabled) return;
      const normalized = normalizeSegmentIndexRange(lo, hi, segmentCount);
      if (!normalized) return;
      applyIndices(rangeIndices(normalized.lo, normalized.hi), normalized.hi, normalized.lo);
    },
    [applyIndices, disabled, segmentCount],
  );

  const selectSegmentIndices = useCallback(
    (indices: Iterable<number>, primaryIdx: number) => {
      if (disabled) return;
      const next = new Set<number>();
      for (const raw of indices) {
        if (raw >= 0 && raw < segmentCount) next.add(raw);
      }
      if (next.size === 0) return;
      const primary = next.has(primaryIdx) ? primaryIdx : Math.min(...next);
      applyIndices(next, primary, Math.min(...next));
    },
    [applyIndices, disabled, segmentCount],
  );

  const isIndexInSelection = useCallback(
    (idx: number) => selectedIndices.has(idx),
    [selectedIndices],
  );

  const selectedIndicesArray = useMemo(() => [...selectedIndices].sort((a, b) => a - b), [selectedIndices]);

  return {
    selectionLo: envelope?.lo ?? 0,
    selectionHi: envelope?.hi ?? 0,
    selectionCount: envelope?.count ?? 0,
    isMultiSegmentSelection: (envelope?.count ?? 0) > 1,
    isContiguousSelection: isContiguousIndexSelection(selectedIndices),
    selectedIndices,
    selectedIndicesArray,
    isIndexInSelection,
    selectionRangeAnchorIdx: rangeAnchorIdx,
    selectSegmentAt,
    selectSegmentRange,
    selectSegmentIndices,
    collapseTo,
    clearMultiSelection,
  };
}
