import { useCallback, useMemo, useRef } from "react";
import {
  withAiRevisedStage,
  withManualTranscribeStage,
} from "../services/segmentStagePersist";
import { flushCm6TextProjection } from "../components/editor/core/onDocChanged";
import { dispatchTranscriptSyncMetaFromSegments } from "../components/editor/core/transcriptEditorViewHandle";
import type { SegmentPublishApi } from "./segmentPublishApi";
import {
  clampSegmentBoundsToNeighbors,
  segmentBoundsMeetMinSpan,
  SEGMENT_BOUNDS_LIVE_MIN_SPAN_SEC,
} from "../utils/segmentGapPolicy";
import { WAVEFORM_SEGMENT_MIN_SPAN_SEC } from "../utils/waveformSegmentBounds";
import { useSegmentSplitController } from "./useSegmentSplitController";
import { useSegmentUndoRedo } from "./useSegmentUndoRedo";
import { createSegmentMergeDeleteActions } from "./segmentMutationMergeDelete";
import { createSegmentInsertActions } from "./segmentMutationInsert";

function roundSec3(x: number): number {
  return Math.round(x * 1000) / 1000;
}

export interface SegmentMutationApi {
  pushUndo: () => void;
  undo: () => void;
  redo: () => void;
  updateSegmentText: (idx: number, text: string, options?: { fromLlm?: boolean }) => void;
  updateSegmentTime: (idx: number, field: "start_sec" | "end_sec", value: number) => void;
  updateSegmentBounds: (idx: number, startSec: number, endSec: number, phase?: "live" | "commit") => void;
  splitAtSelection: (selectedIdx: number) => void;
  splitAtPlayhead: (timeSec: number) => void;
  mergeWithPrev: (selectedIdx: number) => void;
  mergeWithNext: (selectedIdx: number) => void;
  mergeWithPrevAt: (idx: number) => void;
  mergeWithNextAt: (idx: number) => void;
  mergeSegmentRange: (lo: number, hi: number) => void;
  deleteSegmentAt: (idx: number) => void;
  deleteSegmentRange: (lo: number, hi: number) => void;
  deleteSegmentIndices: (indices: number[]) => void;
  insertSegmentAfter: (idx: number, mediaDurationSec?: number) => void;
  insertSegmentFromTimeRange: (
    startSec: number,
    endSec: number,
    mediaDurationSec?: number,
    policy?: import("../utils/segmentTimeRange").SegmentOverlapPolicy,
  ) => number | null;
  flushTranscriptTextProjection: () => void;
  /** @deprecated Alias of flushTranscriptTextProjection */
  flushSegmentTextDrafts: () => void;
  resetMutationHistory: () => void;
}

type SegmentMutationDeps = {
  segmentPublish: SegmentPublishApi;
  selectedIdxRef: React.MutableRefObject<number>;
  setSelectedIdx: (idx: number) => void;
  setError: (msg: string) => void;
  busy: boolean;
  pendingAiRevisedUidsRef?: React.MutableRefObject<Set<string>>;
  onSelectionCollapsed?: (idx: number) => void;
  onSegmentsStructureRestored?: () => void;
};

export function useSegmentMutationController(deps: SegmentMutationDeps): SegmentMutationApi {
  const {
    segmentPublish,
    selectedIdxRef,
    setSelectedIdx,
    setError,
    busy,
    pendingAiRevisedUidsRef,
    onSelectionCollapsed,
    onSegmentsStructureRestored,
  } = deps;

  const segmentBoundsLiveGestureRef = useRef(false);

  const getCurrentSegmentsSnapshot = segmentPublish.getCurrentSegmentsSnapshot;
  const undoRedo = useSegmentUndoRedo(segmentPublish.publishTextBulk, getCurrentSegmentsSnapshot);

  const { pushUndo, pushUndoForTextEdit, undo: undoStackPop, redo: redoStackPop } = undoRedo;

  const updateSegmentText = useCallback(
    (idx: number, text: string, options?: { fromLlm?: boolean }) => {
      if (busy) return;
      const prev = getCurrentSegmentsSnapshot();
      const cur = prev[idx];
      if (!cur || cur.text === text) return;
      pushUndoForTextEdit(idx);
      const uid = cur.uid?.trim();
      if (!options?.fromLlm && uid && pendingAiRevisedUidsRef) {
        pendingAiRevisedUidsRef.current.delete(uid);
      }
      const nextRow = { ...cur, text };
      const patched = options?.fromLlm
        ? withAiRevisedStage(nextRow)
        : withManualTranscribeStage(nextRow);
      segmentPublish.publishTextBulk((base) => {
        const out = [...base];
        out[idx] = patched;
        return out;
      });
      if (options?.fromLlm && uid && pendingAiRevisedUidsRef) {
        pendingAiRevisedUidsRef.current.add(uid);
      }
    },
    [busy, getCurrentSegmentsSnapshot, segmentPublish, pushUndoForTextEdit, pendingAiRevisedUidsRef],
  );

  const flushTranscriptTextProjection = useCallback(() => {
    flushCm6TextProjection({
      baseline: getCurrentSegmentsSnapshot(),
      updateSegmentText: (idx, text) => updateSegmentText(idx, text),
    });
  }, [getCurrentSegmentsSnapshot, updateSegmentText]);

  const undo = useCallback(() => {
    if (busy) return;
    undoStackPop();
    onSegmentsStructureRestored?.();
  }, [busy, onSegmentsStructureRestored, undoStackPop]);

  const redo = useCallback(() => {
    if (busy) return;
    redoStackPop();
    onSegmentsStructureRestored?.();
  }, [busy, onSegmentsStructureRestored, redoStackPop]);

  const mergeDelete = useMemo(
    () =>
      createSegmentMergeDeleteActions({
        segmentPublish,
        selectedIdxRef,
        setSelectedIdx,
        setError,
        pushUndo,
        onSelectionCollapsed,
      }),
    [
      segmentPublish,
      selectedIdxRef,
      setSelectedIdx,
      setError,
      pushUndo,
      onSelectionCollapsed,
    ],
  );

  const insertActions = useMemo(
    () =>
      createSegmentInsertActions({
        busy,
        segmentPublish,
        setSelectedIdx,
        setError,
        pushUndo,
        onSelectionCollapsed,
      }),
    [
      busy,
      segmentPublish,
      setSelectedIdx,
      setError,
      pushUndo,
      onSelectionCollapsed,
    ],
  );

  const splits = useSegmentSplitController({
    segmentPublish,
    setSelectedIdx,
    setError,
    pushUndo,
    onSelectionCollapsed,
  });

  const updateSegmentTime = useCallback(
    (idx: number, field: "start_sec" | "end_sec", value: number) => {
      const prev = getCurrentSegmentsSnapshot();
      const cur = prev[idx];
      if (!cur || cur[field] === value) return;
      pushUndo();
      const next = prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s));
      segmentPublish.publishStructure(() => next);
      dispatchTranscriptSyncMetaFromSegments(next);
    },
    [getCurrentSegmentsSnapshot, pushUndo, segmentPublish],
  );

  const updateSegmentBounds = useCallback(
    (idx: number, startSec: number, endSec: number, phase: "live" | "commit" = "commit") => {
      const prev = getCurrentSegmentsSnapshot();
      const s = prev[idx];
      if (!s) return;
      let lo = Math.min(startSec, endSec);
      let hi = Math.max(startSec, endSec);
      const prevSeg = prev[idx - 1];
      const nextSeg = prev[idx + 1];
      ({ startSec: lo, endSec: hi } = clampSegmentBoundsToNeighbors(lo, hi, {
        prevEndSec: prevSeg?.end_sec,
        nextStartSec: nextSeg?.start_sec,
      }));
      lo = roundSec3(lo);
      hi = roundSec3(hi);
      const minSpan = phase === "live" ? SEGMENT_BOUNDS_LIVE_MIN_SPAN_SEC : WAVEFORM_SEGMENT_MIN_SPAN_SEC;
      if (!segmentBoundsMeetMinSpan(lo, hi, minSpan)) {
        if (phase === "commit") segmentBoundsLiveGestureRef.current = false;
        return;
      }
      if (Math.abs(s.start_sec - lo) < 0.0005 && Math.abs(s.end_sec - hi) < 0.0005) {
        if (phase === "commit") segmentBoundsLiveGestureRef.current = false;
        return;
      }

      if (phase === "live") {
        if (!segmentBoundsLiveGestureRef.current) {
          segmentBoundsLiveGestureRef.current = true;
          pushUndo();
        }
        const next = prev.map((x, i) => (i === idx ? { ...x, start_sec: lo, end_sec: hi } : x));
        segmentPublish.publishStructureLive(() => next);
        dispatchTranscriptSyncMetaFromSegments(next);
        return;
      }

      const hadLiveGesture = segmentBoundsLiveGestureRef.current;
      segmentBoundsLiveGestureRef.current = false;
      if (!hadLiveGesture) pushUndo();
      const next = prev.map((x, i) => (i === idx ? { ...x, start_sec: lo, end_sec: hi } : x));
      segmentPublish.publishStructure(() => next);
      dispatchTranscriptSyncMetaFromSegments(next);
    },
    [getCurrentSegmentsSnapshot, segmentPublish, pushUndo],
  );

  return {
    pushUndo,
    undo,
    redo,
    updateSegmentText,
    updateSegmentTime,
    updateSegmentBounds,
    splitAtSelection: splits.splitAtSelection,
    splitAtPlayhead: splits.splitAtPlayhead,
    mergeWithPrev: mergeDelete.mergeWithPrev,
    mergeWithNext: mergeDelete.mergeWithNext,
    mergeWithPrevAt: mergeDelete.mergeWithPrevAt,
    mergeWithNextAt: mergeDelete.mergeWithNextAt,
    mergeSegmentRange: mergeDelete.mergeSegmentRange,
    deleteSegmentAt: mergeDelete.deleteSegmentAt,
    deleteSegmentRange: mergeDelete.deleteSegmentRange,
    deleteSegmentIndices: mergeDelete.deleteSegmentIndices,
    insertSegmentAfter: insertActions.insertSegmentAfter,
    insertSegmentFromTimeRange: insertActions.insertSegmentFromTimeRange,
    flushTranscriptTextProjection,
    flushSegmentTextDrafts: flushTranscriptTextProjection,
    resetMutationHistory: undoRedo.reset,
  };
}
