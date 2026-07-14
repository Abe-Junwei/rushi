import { useCallback } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import { resolveLiveSegmentText } from "../utils/segmentTextNormalize";
import { buildSplitPair, reindexSegments } from "./segmentListHelpers";
import type { SegmentPublishApi } from "./segmentPublishApi";
import { readTranscriptEditorCoreEnabled } from "../components/editor/core/transcriptEditorCoreFlag";
import {
  dispatchTranscriptSplitAtMidpoint,
  dispatchTranscriptSplitAtTime,
} from "../components/editor/core/transcriptEditorViewHandle";
import { persistTranscriptStructureFromView } from "../components/editor/core/persistTranscriptStructureFromView";
import { finalizeStructureChangeSelection } from "./finalizeStructureChangeSelection";
import { isSegmentFrozen } from "../utils/frozenPlaybackSkip";

function roundSec3(x: number): number {
  return Math.round(x * 1000) / 1000;
}

export interface SegmentSplitApi {
  splitAtSelection: (selectedIdx: number) => void;
  splitAtPlayhead: (timeSec: number) => void;
}

export interface SegmentSplitDeps {
  segmentPublish: SegmentPublishApi;
  setSelectedIdx: (idx: number) => void;
  setError: (msg: string) => void;
  pushUndo: () => void;
  onSelectionCollapsed?: (idx: number) => void;
  /** Display / authority playhead for post-split selection (seam → right). */
  getPlayheadSec?: () => number;
  onStructurePlaybackRemap?: (
    playheadSec: number,
    segments?: readonly SegmentDto[],
  ) => void;
}

export function useSegmentSplitController(deps: SegmentSplitDeps): SegmentSplitApi {
  const {
    segmentPublish,
    setSelectedIdx,
    setError,
    pushUndo,
    onSelectionCollapsed,
    getPlayheadSec,
    onStructurePlaybackRemap,
  } = deps;

  const applyPlayheadSelection = useCallback(
    (
      playheadSec: number,
      opts?: {
        affectedBounds?: { startSec: number; endSec: number };
        fallbackIdx?: number;
      },
    ) => {
      finalizeStructureChangeSelection({
        segments: segmentPublish.getCurrentSegmentsSnapshot(),
        playheadSec,
        setSelectedIdx,
        onSelectionCollapsed,
        onStructurePlaybackRemap,
        affectedBounds: opts?.affectedBounds,
        fallbackIdx: opts?.fallbackIdx,
      });
    },
    [onSelectionCollapsed, onStructurePlaybackRemap, segmentPublish, setSelectedIdx],
  );

  const persistCore = useCallback(
    (
      baseline: Parameters<typeof persistTranscriptStructureFromView>[0],
      playheadSec: number,
      opts?: {
        affectedBounds?: { startSec: number; endSec: number };
        fallbackIdx?: number;
      },
    ) =>
      persistTranscriptStructureFromView(baseline, {
        pushUndo,
        publishStructure: (next) => segmentPublish.publishStructure(next),
        onPrimaryIdx: (cmIdx) => {
          applyPlayheadSelection(playheadSec, {
            affectedBounds: opts?.affectedBounds,
            fallbackIdx: opts?.fallbackIdx ?? cmIdx,
          });
        },
      }),
    [applyPlayheadSelection, pushUndo, segmentPublish],
  );

  const splitAtSelection = useCallback(
    (selectedIdx: number) => {
      const playheadSec = getPlayheadSec?.() ?? 0;
      const segs0 = segmentPublish.getCurrentSegmentsSnapshot();
      if (segs0.length === 0) return;
      const i0 = Math.min(selectedIdx, segs0.length - 1);
      if (isSegmentFrozen(segs0[i0])) {
        setError("请先解冻语段后再合并、拆分或删除");
        return;
      }
      if (readTranscriptEditorCoreEnabled()) {
        const segs = segs0;
        if (segs.length === 0) return;
        const i = Math.min(selectedIdx, segs.length - 1);
        const orig = segs[i];
        // Midpoint split of the selected segment: playhead may sit elsewhere on the
        // timeline, so only follow it when it is inside the split segment (else right half).
        const opts = orig
          ? {
              affectedBounds: { startSec: orig.start_sec, endSec: orig.end_sec },
              fallbackIdx: i + 1,
            }
          : { fallbackIdx: i + 1 };
        if (dispatchTranscriptSplitAtMidpoint(segs, i) && persistCore(segs, playheadSec, opts)) {
          setError("");
          return;
        }
      }
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
      applyPlayheadSelection(playheadSec, {
        affectedBounds: { startSec: s.start_sec, endSec: s.end_sec },
        fallbackIdx: i + 1,
      });
    },
    [applyPlayheadSelection, getPlayheadSec, persistCore, pushUndo, segmentPublish, setError],
  );

  const splitAtPlayhead = useCallback(
    (timeSec: number) => {
      const playheadSec = Number.isFinite(timeSec) ? timeSec : (getPlayheadSec?.() ?? 0);
      const segsProbe = segmentPublish.getCurrentSegmentsSnapshot();
      const tProbe = roundSec3(playheadSec);
      const iProbe = segsProbe.findIndex(
        (s) => tProbe > s.start_sec + 0.02 && tProbe < s.end_sec - 0.02,
      );
      if (iProbe >= 0 && isSegmentFrozen(segsProbe[iProbe])) {
        setError("请先解冻语段后再合并、拆分或删除");
        return;
      }
      if (readTranscriptEditorCoreEnabled()) {
        const segs = segsProbe;
        if (dispatchTranscriptSplitAtTime(segs, playheadSec) && persistCore(segs, playheadSec)) {
          setError("");
          return;
        }
      }
      segmentPublish.commitTextDraftsForStructureMutation();
      const t = roundSec3(playheadSec);
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
      applyPlayheadSelection(t);
    },
    [applyPlayheadSelection, getPlayheadSec, persistCore, pushUndo, segmentPublish, setError],
  );

  return { splitAtSelection, splitAtPlayhead };
}
