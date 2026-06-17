import { useCallback, useRef, useState } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import { segmentHasTextContent } from "../services/segmentConfirmEligible";

type PendingDelete =
  | { kind: "single"; idx: number }
  | { kind: "range"; lo: number; hi: number }
  | { kind: "indices"; indices: number[] };

type Args = {
  getCurrentSegmentsSnapshot: () => SegmentDto[];
  flushSegmentTextDrafts: () => void;
  deleteSegmentAt: (idx: number) => void;
  deleteSegmentRange: (lo: number, hi: number) => void;
  deleteSegmentIndices: (indices: number[]) => void;
};

function rangeHasTextContent(segments: SegmentDto[], lo: number, hi: number): boolean {
  for (let i = lo; i <= hi; i += 1) {
    if (segmentHasTextContent(segments, i)) return true;
  }
  return false;
}

function indicesHaveTextContent(segments: SegmentDto[], indices: number[]): boolean {
  for (const idx of indices) {
    if (segmentHasTextContent(segments, idx)) return true;
  }
  return false;
}

export function useSegmentDeleteConfirmController(args: Args) {
  const { getCurrentSegmentsSnapshot, flushSegmentTextDrafts, deleteSegmentAt, deleteSegmentRange, deleteSegmentIndices } =
    args;
  const pendingRef = useRef<PendingDelete | null>(null);
  const [segmentDeleteConfirmOpen, setSegmentDeleteConfirmOpen] = useState(false);
  const [pendingDeleteCount, setPendingDeleteCount] = useState(1);

  const setPending = useCallback((pending: PendingDelete | null) => {
    pendingRef.current = pending;
    setSegmentDeleteConfirmOpen(pending != null);
    setPendingDeleteCount(
      pending?.kind === "range"
        ? pending.hi - pending.lo + 1
        : pending?.kind === "indices"
          ? pending.indices.length
          : pending
            ? 1
            : 1,
    );
  }, []);

  const requestDeleteSegmentAt = useCallback(
    (idx: number) => {
      flushSegmentTextDrafts();
      const segs = getCurrentSegmentsSnapshot();
      if (idx < 0 || idx >= segs.length) return;
      if (segmentHasTextContent(segs, idx)) {
        setPending({ kind: "single", idx });
        return;
      }
      deleteSegmentAt(idx);
    },
    [deleteSegmentAt, flushSegmentTextDrafts, getCurrentSegmentsSnapshot, setPending],
  );

  const requestDeleteSelection = useCallback(
    (lo: number, hi: number) => {
      flushSegmentTextDrafts();
      const segs = getCurrentSegmentsSnapshot();
      if (lo < 0 || hi >= segs.length || lo > hi) return;
      if (lo === hi) {
        requestDeleteSegmentAt(lo);
        return;
      }
      if (rangeHasTextContent(segs, lo, hi)) {
        setPending({ kind: "range", lo, hi });
        return;
      }
      deleteSegmentRange(lo, hi);
    },
    [deleteSegmentRange, flushSegmentTextDrafts, getCurrentSegmentsSnapshot, requestDeleteSegmentAt, setPending],
  );

  const requestDeleteSelectedIndices = useCallback(
    (indices: number[]) => {
      flushSegmentTextDrafts();
      const segs = getCurrentSegmentsSnapshot();
      const unique = [...new Set(indices)].filter((idx) => idx >= 0 && idx < segs.length);
      if (unique.length === 0) return;
      if (unique.length === 1) {
        const idx = unique[0];
        if (idx !== undefined) requestDeleteSegmentAt(idx);
        return;
      }
      if (indicesHaveTextContent(segs, unique)) {
        setPending({ kind: "indices", indices: unique.sort((a, b) => a - b) });
        return;
      }
      deleteSegmentIndices(unique);
    },
    [deleteSegmentIndices, flushSegmentTextDrafts, getCurrentSegmentsSnapshot, requestDeleteSegmentAt, setPending],
  );

  const confirmDeleteSegment = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    if (pending.kind === "range") deleteSegmentRange(pending.lo, pending.hi);
    else if (pending.kind === "indices") deleteSegmentIndices(pending.indices);
    else deleteSegmentAt(pending.idx);
    setPending(null);
  }, [deleteSegmentAt, deleteSegmentIndices, deleteSegmentRange, setPending]);

  const cancelDeleteSegment = useCallback(() => {
    setPending(null);
  }, [setPending]);

  return {
    segmentDeleteConfirmOpen,
    pendingDeleteCount,
    requestDeleteSegmentAt,
    requestDeleteSelection,
    requestDeleteSelectedIndices,
    confirmDeleteSegment,
    cancelDeleteSegment,
  };
}
