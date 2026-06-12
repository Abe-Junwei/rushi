import type { SegmentDto } from "../tauri/projectApi";
import { mergeTwoSegments, reindexSegments } from "./segmentListHelpers";
import { mergeSegmentRangeFold, resolveSelectedIdxAfterIndexRemoval } from "../utils/segmentSelection";
import {
  commitSegmentTextDraftsForStructureMutation,
  publishSegmentStructureMutation,
  resolveLiveSegmentText,
} from "./flushSegmentTextDrafts";

export type SegmentMergeDeleteDeps = {
  segmentsRef: React.MutableRefObject<SegmentDto[]>;
  setSegments: React.Dispatch<React.SetStateAction<SegmentDto[]>>;
  selectedIdxRef: React.MutableRefObject<number>;
  setSelectedIdx: React.Dispatch<React.SetStateAction<number>>;
  setError: (msg: string) => void;
  pushUndo: () => void;
  onSelectionCollapsed?: (idx: number) => void;
};

function mergePairWithLiveText(a: SegmentDto, b: SegmentDto, idxA: number, idxB: number): SegmentDto {
  return mergeTwoSegments(
    { ...a, text: resolveLiveSegmentText(a, idxA) },
    { ...b, text: resolveLiveSegmentText(b, idxB) },
  );
}

export function createSegmentMergeDeleteActions(deps: SegmentMergeDeleteDeps) {
  const {
    segmentsRef,
    setSegments,
    selectedIdxRef,
    setSelectedIdx,
    setError,
    pushUndo,
    onSelectionCollapsed,
  } = deps;

  function mergeWithPrevAt(idx: number) {
    if (idx <= 0) return;
    commitSegmentTextDraftsForStructureMutation(segmentsRef, setSegments);
    pushUndo();
    const base = segmentsRef.current;
    if (idx <= 0 || idx >= base.length) return;
    const a = base[idx - 1];
    const b = base[idx];
    if (!a || !b) return;
    const merged = mergePairWithLiveText(a, b, idx - 1, idx);
    const out = [...base];
    out.splice(idx - 1, 2, merged);
    publishSegmentStructureMutation(segmentsRef, setSegments, reindexSegments(out));
    setSelectedIdx(idx - 1);
    onSelectionCollapsed?.(idx - 1);
  }

  function mergeWithNextAt(idx: number) {
    commitSegmentTextDraftsForStructureMutation(segmentsRef, setSegments);
    pushUndo();
    const base = segmentsRef.current;
    if (idx < 0 || idx >= base.length - 1) return;
    const a = base[idx];
    const b = base[idx + 1];
    if (!a || !b) return;
    const merged = mergePairWithLiveText(a, b, idx, idx + 1);
    const out = [...base];
    out.splice(idx, 2, merged);
    publishSegmentStructureMutation(segmentsRef, setSegments, reindexSegments(out));
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
    commitSegmentTextDraftsForStructureMutation(segmentsRef, setSegments);
    pushUndo();
    const base = segmentsRef.current;
    if (lo < 0 || hi >= base.length || lo >= hi) return;
    const merged = mergeSegmentRangeFold(base, lo, hi);
    const out = [...base.slice(0, lo), merged, ...base.slice(hi + 1)];
    publishSegmentStructureMutation(segmentsRef, setSegments, reindexSegments(out));
    setSelectedIdx(lo);
    onSelectionCollapsed?.(lo);
  }

  function deleteSegmentAtAfterCommit(idx: number) {
    const segs = segmentsRef.current;
    if (idx < 0 || idx >= segs.length) return;
    setError("");
    pushUndo();
    publishSegmentStructureMutation(
      segmentsRef,
      setSegments,
      reindexSegments(segs.filter((_, j) => j !== idx)),
    );
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

  function deleteSegmentAt(idx: number) {
    commitSegmentTextDraftsForStructureMutation(segmentsRef, setSegments);
    deleteSegmentAtAfterCommit(idx);
  }

  function deleteSegmentRange(lo: number, hi: number) {
    commitSegmentTextDraftsForStructureMutation(segmentsRef, setSegments);
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
    publishSegmentStructureMutation(
      segmentsRef,
      setSegments,
      reindexSegments(segs.filter((_, j) => j < lo || j > hi)),
    );
    setSelectedIdx(nextSelected);
    onSelectionCollapsed?.(nextSelected);
  }

  function deleteSegmentIndices(rawIndices: number[]) {
    commitSegmentTextDraftsForStructureMutation(segmentsRef, setSegments);
    const segs = segmentsRef.current;
    const indices = [...new Set(rawIndices)]
      .filter((idx) => idx >= 0 && idx < segs.length)
      .sort((a, b) => b - a);
    if (indices.length === 0) return;
    if (indices.length === 1) {
      const idx = indices[0];
      if (idx !== undefined) deleteSegmentAtAfterCommit(idx);
      return;
    }
    setError("");
    pushUndo();
    const remove = new Set(indices);
    const prevSelected = selectedIdxRef.current;
    const nextLen = segs.length - indices.length;
    const nextSelected = resolveSelectedIdxAfterIndexRemoval(segs.length, indices, prevSelected);
    publishSegmentStructureMutation(
      segmentsRef,
      setSegments,
      reindexSegments(segs.filter((_, j) => !remove.has(j))),
    );
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
