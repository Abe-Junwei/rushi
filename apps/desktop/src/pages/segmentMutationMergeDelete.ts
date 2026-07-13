import type { SegmentDto } from "../tauri/projectApi";
import { mergeTwoSegments, reindexSegments } from "./segmentListHelpers";
import { mergeSegmentRangeFold, resolveSelectedIdxAfterIndexRemoval } from "../utils/segmentSelection";
import { resolveLiveSegmentText } from "./flushSegmentTextDrafts";
import type { SegmentPublishApi } from "./segmentPublishApi";
import { readTranscriptEditorCoreEnabled } from "../components/editor/core/transcriptEditorCoreFlag";
import {
  dispatchTranscriptDeleteAt,
  dispatchTranscriptDeleteIndices,
  dispatchTranscriptDeleteRange,
  dispatchTranscriptMergeRange,
  dispatchTranscriptMergeWithNext,
  dispatchTranscriptMergeWithPrev,
} from "../components/editor/core/transcriptEditorViewHandle";
import { persistTranscriptStructureFromView } from "../components/editor/core/persistTranscriptStructureFromView";
import { finalizeStructureChangeSelection } from "./finalizeStructureChangeSelection";

export type SegmentMergeDeleteDeps = {
  segmentPublish: SegmentPublishApi;
  selectedIdxRef: React.MutableRefObject<number>;
  setSelectedIdx: (idx: number) => void;
  setError: (msg: string) => void;
  pushUndo: () => void;
  onSelectionCollapsed?: (idx: number) => void;
  getPlayheadSec?: () => number;
  onStructurePlaybackRemap?: (
    playheadSec: number,
    segments?: readonly SegmentDto[],
  ) => void;
};

function mergePairWithLiveText(a: SegmentDto, b: SegmentDto, idxA: number, idxB: number): SegmentDto {
  return mergeTwoSegments(
    { ...a, text: resolveLiveSegmentText(a, idxA) },
    { ...b, text: resolveLiveSegmentText(b, idxB) },
  );
}

type StructureSelectionOpts = {
  affectedBounds?: { startSec: number; endSec: number };
  fallbackIdx?: number;
};

/** Merged span [start,end] used to gate playhead-follow selection to the edited region. */
function mergeBounds(
  base: readonly SegmentDto[],
  from: number,
  to: number,
): { startSec: number; endSec: number } | undefined {
  const a = base[from];
  const b = base[to];
  if (!a || !b) return undefined;
  return {
    startSec: Math.min(a.start_sec, b.start_sec),
    endSec: Math.max(a.end_sec, b.end_sec),
  };
}

function applyPlayheadSelection(deps: SegmentMergeDeleteDeps, opts?: StructureSelectionOpts): void {
  const playheadSec = deps.getPlayheadSec?.() ?? 0;
  finalizeStructureChangeSelection({
    segments: deps.segmentPublish.getCurrentSegmentsSnapshot(),
    playheadSec,
    setSelectedIdx: deps.setSelectedIdx,
    onSelectionCollapsed: deps.onSelectionCollapsed,
    onStructurePlaybackRemap: deps.onStructurePlaybackRemap,
    affectedBounds: opts?.affectedBounds,
    fallbackIdx: opts?.fallbackIdx,
  });
}

/** Delete keeps index-mapped selection; still remap sticky playback to playhead geometry. */
function remapStickyPlaybackOnly(deps: SegmentMergeDeleteDeps): void {
  const playheadSec = deps.getPlayheadSec?.() ?? 0;
  deps.onStructurePlaybackRemap?.(
    playheadSec,
    deps.segmentPublish.getCurrentSegmentsSnapshot(),
  );
}

function persistMergeStructure(
  baseline: readonly SegmentDto[],
  deps: SegmentMergeDeleteDeps,
  opts?: StructureSelectionOpts,
): boolean {
  return persistTranscriptStructureFromView(baseline, {
    pushUndo: deps.pushUndo,
    publishStructure: (next) => deps.segmentPublish.publishStructure(next),
    onPrimaryIdx: (cmIdx) => {
      applyPlayheadSelection(deps, {
        affectedBounds: opts?.affectedBounds,
        fallbackIdx: opts?.fallbackIdx ?? cmIdx,
      });
    },
  });
}

function persistDeleteStructure(
  baseline: readonly SegmentDto[],
  deps: SegmentMergeDeleteDeps,
): boolean {
  return persistTranscriptStructureFromView(baseline, {
    pushUndo: deps.pushUndo,
    publishStructure: (next) => deps.segmentPublish.publishStructure(next),
    onPrimaryIdx: (idx) => {
      deps.setSelectedIdx(idx);
      deps.onSelectionCollapsed?.(idx);
      remapStickyPlaybackOnly(deps);
    },
  });
}

export function createSegmentMergeDeleteActions(deps: SegmentMergeDeleteDeps) {
  const {
    segmentPublish,
    selectedIdxRef,
    setSelectedIdx,
    setError,
    pushUndo,
    onSelectionCollapsed,
  } = deps;

  function mergeWithPrevAt(idx: number) {
    if (idx <= 0) return;
    if (readTranscriptEditorCoreEnabled()) {
      const base = segmentPublish.getCurrentSegmentsSnapshot();
      const opts = { affectedBounds: mergeBounds(base, idx - 1, idx), fallbackIdx: idx - 1 };
      if (dispatchTranscriptMergeWithPrev(base, idx) && persistMergeStructure(base, deps, opts)) {
        return;
      }
    }
    segmentPublish.commitTextDraftsForStructureMutation();
    pushUndo();
    const base = segmentPublish.getCurrentSegmentsSnapshot();
    if (idx <= 0 || idx >= base.length) return;
    const a = base[idx - 1];
    const b = base[idx];
    if (!a || !b) return;
    const bounds = mergeBounds(base, idx - 1, idx);
    const merged = mergePairWithLiveText(a, b, idx - 1, idx);
    const out = [...base];
    out.splice(idx - 1, 2, merged);
    segmentPublish.publishStructure(reindexSegments(out));
    applyPlayheadSelection(deps, { affectedBounds: bounds, fallbackIdx: idx - 1 });
  }

  function mergeWithNextAt(idx: number) {
    if (readTranscriptEditorCoreEnabled()) {
      const base = segmentPublish.getCurrentSegmentsSnapshot();
      const opts = { affectedBounds: mergeBounds(base, idx, idx + 1), fallbackIdx: idx };
      if (dispatchTranscriptMergeWithNext(base, idx) && persistMergeStructure(base, deps, opts)) {
        return;
      }
    }
    segmentPublish.commitTextDraftsForStructureMutation();
    pushUndo();
    const base = segmentPublish.getCurrentSegmentsSnapshot();
    if (idx < 0 || idx >= base.length - 1) return;
    const a = base[idx];
    const b = base[idx + 1];
    if (!a || !b) return;
    const bounds = mergeBounds(base, idx, idx + 1);
    const merged = mergePairWithLiveText(a, b, idx, idx + 1);
    const out = [...base];
    out.splice(idx, 2, merged);
    segmentPublish.publishStructure(reindexSegments(out));
    applyPlayheadSelection(deps, { affectedBounds: bounds, fallbackIdx: idx });
  }

  function mergeWithPrev(selectedIdx: number) {
    mergeWithPrevAt(selectedIdx);
  }

  function mergeWithNext(selectedIdx: number) {
    mergeWithNextAt(selectedIdx);
  }

  function mergeSegmentRange(lo: number, hi: number) {
    if (readTranscriptEditorCoreEnabled()) {
      const base = segmentPublish.getCurrentSegmentsSnapshot();
      const opts = { affectedBounds: mergeBounds(base, lo, hi), fallbackIdx: lo };
      if (dispatchTranscriptMergeRange(base, lo, hi) && persistMergeStructure(base, deps, opts)) {
        return;
      }
    }
    segmentPublish.commitTextDraftsForStructureMutation();
    pushUndo();
    const base = segmentPublish.getCurrentSegmentsSnapshot();
    if (lo < 0 || hi >= base.length || lo >= hi) return;
    const bounds = mergeBounds(base, lo, hi);
    const merged = mergeSegmentRangeFold(base, lo, hi);
    const out = [...base.slice(0, lo), merged, ...base.slice(hi + 1)];
    segmentPublish.publishStructure(reindexSegments(out));
    applyPlayheadSelection(deps, { affectedBounds: bounds, fallbackIdx: lo });
  }

  function deleteSegmentAtAfterCommit(idx: number) {
    const segs = segmentPublish.getCurrentSegmentsSnapshot();
    if (idx < 0 || idx >= segs.length) return;
    setError("");
    pushUndo();
    segmentPublish.publishStructure(reindexSegments(segs.filter((_, j) => j !== idx)));
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
    remapStickyPlaybackOnly(deps);
  }

  function deleteSegmentAt(idx: number) {
    if (readTranscriptEditorCoreEnabled()) {
      const base = segmentPublish.getCurrentSegmentsSnapshot();
      if (dispatchTranscriptDeleteAt(base, idx) && persistDeleteStructure(base, deps)) {
        return;
      }
    }
    segmentPublish.commitTextDraftsForStructureMutation();
    deleteSegmentAtAfterCommit(idx);
  }

  function deleteSegmentRange(lo: number, hi: number) {
    if (readTranscriptEditorCoreEnabled()) {
      const base = segmentPublish.getCurrentSegmentsSnapshot();
      if (dispatchTranscriptDeleteRange(base, lo, hi) && persistDeleteStructure(base, deps)) {
        return;
      }
    }
    segmentPublish.commitTextDraftsForStructureMutation();
    const segs = segmentPublish.getCurrentSegmentsSnapshot();
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
    segmentPublish.publishStructure(reindexSegments(segs.filter((_, j) => j < lo || j > hi)));
    setSelectedIdx(nextSelected);
    onSelectionCollapsed?.(nextSelected);
    remapStickyPlaybackOnly(deps);
  }

  function deleteSegmentIndices(rawIndices: number[]) {
    if (readTranscriptEditorCoreEnabled()) {
      const base = segmentPublish.getCurrentSegmentsSnapshot();
      const prevSelected = selectedIdxRef.current;
      if (
        dispatchTranscriptDeleteIndices(base, rawIndices, prevSelected) &&
        persistDeleteStructure(base, deps)
      ) {
        setError("");
        return;
      }
    }
    segmentPublish.commitTextDraftsForStructureMutation();
    const segs = segmentPublish.getCurrentSegmentsSnapshot();
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
    segmentPublish.publishStructure(reindexSegments(segs.filter((_, j) => !remove.has(j))));
    setSelectedIdx(Math.max(0, Math.min(nextSelected, nextLen - 1)));
    onSelectionCollapsed?.(Math.max(0, Math.min(nextSelected, nextLen - 1)));
    remapStickyPlaybackOnly(deps);
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
