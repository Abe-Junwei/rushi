import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  isContiguousIndexSelection,
  selectionEnvelope,
} from "../utils/segmentSelection";
import {
  getTranscriptProjectionSnapshot,
  subscribeTranscriptProjection,
} from "../components/editor/core/transcriptProjection";
import {
  dispatchTranscriptEditorSelection,
  dispatchTranscriptEditorSelectionIndices,
  dispatchTranscriptEditorSelectionRange,
} from "../components/editor/core/transcriptEditorViewHandle";

type Args = {
  segmentCount: number;
  selectedIdxRef: React.MutableRefObject<number>;
  disabled?: boolean;
};

/**
 * P9b2: selection fields mirrored from CM6 transcriptProjection (read-only).
 * Writes go through dispatchTranscriptEditorSelection*.
 */
export function useTranscriptSelectionFromProjection(args: Args) {
  const { segmentCount, selectedIdxRef, disabled = false } = args;

  const snap = useSyncExternalStore(
    subscribeTranscriptProjection,
    getTranscriptProjectionSnapshot,
    getTranscriptProjectionSnapshot,
  );

  const selectedIdx =
    snap.primaryIdx >= 0 && (segmentCount <= 0 || snap.primaryIdx < segmentCount)
      ? snap.primaryIdx
      : segmentCount > 0
        ? Math.min(Math.max(0, selectedIdxRef.current), segmentCount - 1)
        : 0;

  selectedIdxRef.current = selectedIdx;

  const selectedIndices = useMemo(() => {
    if (segmentCount <= 0) return new Set<number>();
    if (snap.primaryIdx < 0 || snap.selectedSet.size === 0) {
      return new Set([selectedIdx]);
    }
    const next = new Set<number>();
    for (const idx of snap.selectedSet) {
      if (idx >= 0 && idx < segmentCount) next.add(idx);
    }
    if (next.size === 0) next.add(selectedIdx);
    return next;
  }, [segmentCount, selectedIdx, snap.primaryIdx, snap.selectedSet]);

  const envelope = useMemo(() => selectionEnvelope(selectedIndices), [selectedIndices]);

  const selectSegmentAt = useCallback(
    (idx: number, opts?: { shiftKey?: boolean; toggle?: boolean }) => {
      if (disabled || idx < 0 || idx >= segmentCount) return;
      dispatchTranscriptEditorSelection(idx, opts);
      selectedIdxRef.current = idx;
    },
    [disabled, segmentCount, selectedIdxRef],
  );

  const selectSegmentRange = useCallback(
    (lo: number, hi: number) => {
      if (disabled) return;
      dispatchTranscriptEditorSelectionRange(lo, hi);
    },
    [disabled],
  );

  const selectSegmentIndices = useCallback(
    (indices: Iterable<number>, primaryIdx: number) => {
      if (disabled) return;
      dispatchTranscriptEditorSelectionIndices(indices, primaryIdx);
      selectedIdxRef.current = primaryIdx;
    },
    [disabled, selectedIdxRef],
  );

  const collapseTo = useCallback(
    (idx: number) => {
      if (segmentCount <= 0) return;
      const clamped = Math.max(0, Math.min(idx, segmentCount - 1));
      dispatchTranscriptEditorSelection(clamped);
      selectedIdxRef.current = clamped;
    },
    [segmentCount, selectedIdxRef],
  );

  const clearMultiSelection = useCallback(() => {
    if (segmentCount <= 0 || selectedIndices.size <= 1) return;
    collapseTo(selectedIdx);
  }, [collapseTo, segmentCount, selectedIdx, selectedIndices.size]);

  const isIndexInSelection = useCallback(
    (idx: number) => selectedIndices.has(idx),
    [selectedIndices],
  );

  const selectedIndicesArray = useMemo(
    () => [...selectedIndices].sort((a, b) => a - b),
    [selectedIndices],
  );

  return {
    selectedIdx,
    selectionLo: envelope?.lo ?? 0,
    selectionHi: envelope?.hi ?? 0,
    selectionCount: envelope?.count ?? 0,
    isMultiSegmentSelection: (envelope?.count ?? 0) > 1,
    isContiguousSelection: isContiguousIndexSelection(selectedIndices),
    selectedIndices,
    selectedIndicesArray,
    isIndexInSelection,
    selectionRangeAnchorIdx: snap.rangeAnchor >= 0 ? snap.rangeAnchor : selectedIdx,
    selectSegmentAt,
    selectSegmentRange,
    selectSegmentIndices,
    collapseTo,
    clearMultiSelection,
  };
}
