import { useCallback, useRef, useState, type MutableRefObject } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import { segmentHasTextContent } from "../services/segmentConfirmEligible";

type Args = {
  segmentsRef: MutableRefObject<SegmentDto[]>;
  flushSegmentTextDrafts: () => void;
  deleteSegmentAt: (idx: number) => void;
};

export function useSegmentDeleteConfirmController(args: Args) {
  const { segmentsRef, flushSegmentTextDrafts, deleteSegmentAt } = args;
  const pendingIdxRef = useRef<number | null>(null);
  const [segmentDeleteConfirmOpen, setSegmentDeleteConfirmOpen] = useState(false);

  const setPendingIdx = useCallback((idx: number | null) => {
    pendingIdxRef.current = idx;
    setSegmentDeleteConfirmOpen(idx != null);
  }, []);

  const requestDeleteSegmentAt = useCallback(
    (idx: number) => {
      flushSegmentTextDrafts();
      const segs = segmentsRef.current;
      if (idx < 0 || idx >= segs.length) return;
      if (segmentHasTextContent(segs, idx)) {
        setPendingIdx(idx);
        return;
      }
      deleteSegmentAt(idx);
    },
    [deleteSegmentAt, flushSegmentTextDrafts, segmentsRef, setPendingIdx],
  );

  const confirmDeleteSegment = useCallback(() => {
    const idx = pendingIdxRef.current;
    if (idx == null) return;
    deleteSegmentAt(idx);
    setPendingIdx(null);
  }, [deleteSegmentAt, setPendingIdx]);

  const cancelDeleteSegment = useCallback(() => {
    setPendingIdx(null);
  }, [setPendingIdx]);

  return {
    segmentDeleteConfirmOpen,
    requestDeleteSegmentAt,
    confirmDeleteSegment,
    cancelDeleteSegment,
  };
}
