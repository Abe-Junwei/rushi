import { useCallback, useRef, useState, type MutableRefObject } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import { segmentHasTextContent } from "../services/segmentConfirmEligible";

type PendingDelete =
  | { kind: "single"; idx: number }
  | { kind: "range"; lo: number; hi: number };

type Args = {
  segmentsRef: MutableRefObject<SegmentDto[]>;
  flushSegmentTextDrafts: () => void;
  deleteSegmentAt: (idx: number) => void;
  deleteSegmentRange: (lo: number, hi: number) => void;
};

function rangeHasTextContent(segments: SegmentDto[], lo: number, hi: number): boolean {
  for (let i = lo; i <= hi; i += 1) {
    if (segmentHasTextContent(segments, i)) return true;
  }
  return false;
}

export function useSegmentDeleteConfirmController(args: Args) {
  const { segmentsRef, flushSegmentTextDrafts, deleteSegmentAt, deleteSegmentRange } = args;
  const pendingRef = useRef<PendingDelete | null>(null);
  const [segmentDeleteConfirmOpen, setSegmentDeleteConfirmOpen] = useState(false);
  const [pendingDeleteCount, setPendingDeleteCount] = useState(1);

  const setPending = useCallback((pending: PendingDelete | null) => {
    pendingRef.current = pending;
    setSegmentDeleteConfirmOpen(pending != null);
    setPendingDeleteCount(
      pending?.kind === "range" ? pending.hi - pending.lo + 1 : pending ? 1 : 1,
    );
  }, []);

  const requestDeleteSegmentAt = useCallback(
    (idx: number) => {
      flushSegmentTextDrafts();
      const segs = segmentsRef.current;
      if (idx < 0 || idx >= segs.length) return;
      if (segmentHasTextContent(segs, idx)) {
        setPending({ kind: "single", idx });
        return;
      }
      deleteSegmentAt(idx);
    },
    [deleteSegmentAt, flushSegmentTextDrafts, segmentsRef, setPending],
  );

  const requestDeleteSelection = useCallback(
    (lo: number, hi: number) => {
      flushSegmentTextDrafts();
      const segs = segmentsRef.current;
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
    [deleteSegmentRange, flushSegmentTextDrafts, requestDeleteSegmentAt, segmentsRef, setPending],
  );

  const confirmDeleteSegment = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    if (pending.kind === "range") deleteSegmentRange(pending.lo, pending.hi);
    else deleteSegmentAt(pending.idx);
    setPending(null);
  }, [deleteSegmentAt, deleteSegmentRange, setPending]);

  const cancelDeleteSegment = useCallback(() => {
    setPending(null);
  }, [setPending]);

  return {
    segmentDeleteConfirmOpen,
    pendingDeleteCount,
    requestDeleteSegmentAt,
    requestDeleteSelection,
    confirmDeleteSegment,
    cancelDeleteSegment,
  };
}
