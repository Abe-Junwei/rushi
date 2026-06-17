import { useCallback } from "react";
import { resolveLiveSegmentText } from "../hooks/useSegmentDraftStore";
import { buildSplitPair, reindexSegments } from "./segmentListHelpers";
import type { SegmentPublishApi } from "./segmentPublishApi";

function roundSec3(x: number): number {
  return Math.round(x * 1000) / 1000;
}

export interface SegmentSplitApi {
  splitAtSelection: (selectedIdx: number) => void;
  splitAtPlayhead: (timeSec: number) => void;
}

export interface SegmentSplitDeps {
  segmentPublish: SegmentPublishApi;
  setSelectedIdx: React.Dispatch<React.SetStateAction<number>>;
  setError: (msg: string) => void;
  pushUndo: () => void;
  onSelectionCollapsed?: (idx: number) => void;
}

export function useSegmentSplitController(deps: SegmentSplitDeps): SegmentSplitApi {
  const { segmentPublish, setSelectedIdx, setError, pushUndo, onSelectionCollapsed } = deps;

  const splitAtSelection = useCallback(
    (selectedIdx: number) => {
      segmentPublish.commitTextDraftsForStructureMutation();
      const segs = segmentPublish.getCurrentSegmentsSnapshot();
      if (segs.length === 0) return;
      const i = Math.min(selectedIdx, segs.length - 1);
      const s = segs[i];
      if (!s) return;
      const mid = (s.start_sec + s.end_sec) / 2;
      const splitPair = buildSplitPair(
        { ...s, text: resolveLiveSegmentText(s, i) },
        mid,
      );
      if (!splitPair) {
        setError("语段太短，无法拆分。");
        return;
      }
      setError("");
      pushUndo();
      const out = [...segs];
      out.splice(i, 1, splitPair.left, splitPair.right);
      segmentPublish.publishStructure(reindexSegments(out));
      const nextIdx = i + 1;
      setSelectedIdx(nextIdx);
      onSelectionCollapsed?.(nextIdx);
    },
    [onSelectionCollapsed, pushUndo, segmentPublish, setError, setSelectedIdx],
  );

  const splitAtPlayhead = useCallback(
    (timeSec: number) => {
      segmentPublish.commitTextDraftsForStructureMutation();
      const t = roundSec3(timeSec);
      const segs = segmentPublish.getCurrentSegmentsSnapshot();
      const i = segs.findIndex((s) => t > s.start_sec + 0.02 && t < s.end_sec - 0.02);
      if (i < 0) {
        setError("指针时间不在任一语段内，无法拆分。");
        return;
      }
      const s = segs[i];
      if (!s) return;
      const splitPair = buildSplitPair({ ...s, text: resolveLiveSegmentText(s, i) }, t);
      if (!splitPair) {
        setError("语段太短，无法在该时间拆分。");
        return;
      }
      setError("");
      pushUndo();
      const out = [...segs];
      out.splice(i, 1, splitPair.left, splitPair.right);
      segmentPublish.publishStructure(reindexSegments(out));
      const nextIdx = i + 1;
      setSelectedIdx(nextIdx);
      onSelectionCollapsed?.(nextIdx);
    },
    [onSelectionCollapsed, pushUndo, segmentPublish, setError, setSelectedIdx],
  );

  return { splitAtSelection, splitAtPlayhead };
}
