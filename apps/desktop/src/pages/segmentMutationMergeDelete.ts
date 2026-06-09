import type { SegmentDto } from "../tauri/projectApi";
import { mergeTwoSegments, reindexSegments } from "./segmentListHelpers";
import { mergeSegmentRangeFold, resolveSelectedIdxAfterIndexRemoval } from "../utils/segmentSelection";

export type SegmentMergeDeleteDeps = {
  segmentsRef: React.MutableRefObject<SegmentDto[]>;
  setSegments: React.Dispatch<React.SetStateAction<SegmentDto[]>>;
  selectedIdxRef: React.MutableRefObject<number>;
  setSelectedIdx: React.Dispatch<React.SetStateAction<number>>;
  setError: (msg: string) => void;
  pushUndo: () => void;
  flushSegmentTextDrafts: () => void;
  onSelectionCollapsed?: (idx: number) => void;
};

export function createSegmentMergeDeleteActions(deps: SegmentMergeDeleteDeps) {
  const {
    segmentsRef,
    setSegments,
    selectedIdxRef,
    setSelectedIdx,
    setError,
    pushUndo,
    flushSegmentTextDrafts,
    onSelectionCollapsed,
  } = deps;

  function mergeWithPrevAt(idx: number) {
    if (idx <= 0) return;
    flushSegmentTextDrafts();
    const segs = segmentsRef.current;
    const a = segs[idx - 1];
    const b = segs[idx];
    if (!a || !b) return;
    pushUndo();
    const merged = mergeTwoSegments(a, b);
    setSegments((p) => {
      const out = [...p];
      out.splice(idx - 1, 2, merged);
      return reindexSegments(out);
    });
    setSelectedIdx(idx - 1);
    onSelectionCollapsed?.(idx - 1);
  }

  function mergeWithNextAt(idx: number) {
    flushSegmentTextDrafts();
    const segs = segmentsRef.current;
    if (idx >= segs.length - 1) return;
    const a = segs[idx];
    const b = segs[idx + 1];
    if (!a || !b) return;
    pushUndo();
    const merged = mergeTwoSegments(a, b);
    setSegments((p) => {
      const out = [...p];
      out.splice(idx, 2, merged);
      return reindexSegments(out);
    });
    setSelectedIdx(idx);
    onSelectionCollapsed?.(idx);
  }

  function mergeWithPrev(selectedIdx: number) {
    mergeWithPrevAt(selectedIdx);
  }

  function mergeWithNext(selectedIdx: number) {
    mergeWithNextAt(selectedIdx);
  }

  function mergeSegmentRange(lo: number, hi: number) {
    flushSegmentTextDrafts();
    const segs = segmentsRef.current;
    if (lo < 0 || hi >= segs.length || lo >= hi) return;
    pushUndo();
    const merged = mergeSegmentRangeFold(segs, lo, hi);
    setSegments((prev) => {
      const out = [...prev.slice(0, lo), merged, ...prev.slice(hi + 1)];
      return reindexSegments(out);
    });
    setSelectedIdx(lo);
    onSelectionCollapsed?.(lo);
  }

  function deleteSegmentAt(idx: number) {
    flushSegmentTextDrafts();
    const segs = segmentsRef.current;
    if (idx < 0 || idx >= segs.length) return;
    setError("");
    pushUndo();
    setSegments((prev) => reindexSegments(prev.filter((_, j) => j !== idx)));
    const nextLen = segs.length - 1;
    const prevSelected = selectedIdxRef.current;
    let nextSelected = prevSelected;
    if (nextLen <= 0) nextSelected = 0;
    else {
      if (idx < prevSelected) nextSelected = prevSelected - 1;
      else if (idx === prevSelected) nextSelected = Math.min(prevSelected, nextLen - 1);
      nextSelected = Math.max(0, Math.min(nextSelected, nextLen - 1));
    }
    setSelectedIdx(nextSelected);
    onSelectionCollapsed?.(nextSelected);
  }

  function deleteSegmentRange(lo: number, hi: number) {
    flushSegmentTextDrafts();
    const segs = segmentsRef.current;
    if (lo < 0 || hi >= segs.length || lo > hi) return;
    setError("");
    pushUndo();
    const prevSelected = selectedIdxRef.current;
    const nextLen = segs.length - (hi - lo + 1);
    let nextSelected = prevSelected;
    if (nextLen <= 0) nextSelected = 0;
    else if (hi < prevSelected) nextSelected = prevSelected - (hi - lo + 1);
    else if (lo <= prevSelected && prevSelected <= hi) nextSelected = Math.min(lo, nextLen - 1);
    nextSelected = Math.max(0, Math.min(nextSelected, nextLen - 1));
    setSegments((prev) => reindexSegments(prev.filter((_, j) => j < lo || j > hi)));
    setSelectedIdx(nextSelected);
    onSelectionCollapsed?.(nextSelected);
  }

  function deleteSegmentIndices(rawIndices: number[]) {
    flushSegmentTextDrafts();
    const segs = segmentsRef.current;
    const indices = [...new Set(rawIndices)]
      .filter((idx) => idx >= 0 && idx < segs.length)
      .sort((a, b) => b - a);
    if (indices.length === 0) return;
    if (indices.length === 1) {
      const idx = indices[0];
      if (idx !== undefined) deleteSegmentAt(idx);
      return;
    }
    setError("");
    pushUndo();
    const remove = new Set(indices);
    const prevSelected = selectedIdxRef.current;
    const nextLen = segs.length - indices.length;
    const nextSelected = resolveSelectedIdxAfterIndexRemoval(segs.length, indices, prevSelected);
    setSegments((prev) => reindexSegments(prev.filter((_, j) => !remove.has(j))));
    setSelectedIdx(Math.max(0, Math.min(nextSelected, nextLen - 1)));
    onSelectionCollapsed?.(Math.max(0, Math.min(nextSelected, nextLen - 1)));
  }

  return {
    mergeWithPrev,
    mergeWithNext,
    mergeWithPrevAt,
    mergeWithNextAt,
    mergeSegmentRange,
    deleteSegmentAt,
    deleteSegmentRange,
    deleteSegmentIndices,
  };
}
