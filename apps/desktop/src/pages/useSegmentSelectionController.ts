import { useCallback, useEffect, useMemo, useState } from "react";
import {
  clampSegmentIndex,
  normalizeSegmentIndexRange,
  resolveSegmentSelectionRange,
  type SegmentSelectionState,
} from "../utils/segmentSelection";

type Args = {
  selectedIdx: number;
  setSelectedIdx: React.Dispatch<React.SetStateAction<number>>;
  segmentCount: number;
  resetKey: string | null;
  disabled?: boolean;
};

export function useSegmentSelectionController(args: Args) {
  const { selectedIdx, setSelectedIdx, segmentCount, resetKey, disabled = false } = args;
  const [selection, setSelection] = useState<SegmentSelectionState | null>(null);

  useEffect(() => {
    setSelection(null);
  }, [resetKey]);

  useEffect(() => {
    if (segmentCount <= 0) setSelection(null);
  }, [segmentCount]);

  /** External selectedIdx writes collapse to a single segment unless focus already matches. */
  useEffect(() => {
    if (segmentCount <= 0) return;
    const clamped = clampSegmentIndex(selectedIdx, segmentCount);
    setSelection((prev) => {
      if (!prev) return { anchorIdx: clamped, focusIdx: clamped };
      if (prev.focusIdx === clamped) return prev;
      return { anchorIdx: clamped, focusIdx: clamped };
    });
  }, [selectedIdx, segmentCount]);

  const range = useMemo(
    () => resolveSegmentSelectionRange(selection, selectedIdx, segmentCount),
    [selection, selectedIdx, segmentCount],
  );

  const collapseTo = useCallback(
    (idx: number) => {
      if (segmentCount <= 0) {
        setSelection(null);
        return;
      }
      const clamped = clampSegmentIndex(idx, segmentCount);
      setSelection({ anchorIdx: clamped, focusIdx: clamped });
    },
    [segmentCount],
  );

  const selectSegmentAt = useCallback(
    (idx: number, opts?: { shiftKey?: boolean }) => {
      if (disabled || idx < 0 || idx >= segmentCount) return;
      if (opts?.shiftKey) {
        const anchor = selection?.anchorIdx ?? selectedIdx;
        setSelection({ anchorIdx: anchor, focusIdx: idx });
      } else {
        setSelection({ anchorIdx: idx, focusIdx: idx });
      }
      setSelectedIdx(idx);
    },
    [disabled, segmentCount, selectedIdx, selection, setSelectedIdx],
  );

  const selectSegmentRange = useCallback(
    (lo: number, hi: number) => {
      if (disabled) return;
      const normalized = normalizeSegmentIndexRange(lo, hi, segmentCount);
      if (!normalized) return;
      setSelection({ anchorIdx: normalized.lo, focusIdx: normalized.hi });
      setSelectedIdx(normalized.hi);
    },
    [disabled, segmentCount, setSelectedIdx],
  );

  const isIndexInSelection = useCallback(
    (idx: number) => {
      if (!range) return false;
      return idx >= range.lo && idx <= range.hi;
    },
    [range],
  );

  return {
    selectionLo: range?.lo ?? 0,
    selectionHi: range?.hi ?? 0,
    selectionCount: range?.count ?? 0,
    isMultiSegmentSelection: (range?.count ?? 0) > 1,
    isIndexInSelection,
    selectSegmentAt,
    selectSegmentRange,
    collapseTo,
  };
}
