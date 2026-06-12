import { useCallback, useMemo, useRef } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import { withAiRevisedStage } from "../services/segmentStagePersist";
import { segmentDraftStore } from "../hooks/useSegmentDraftStore";
import {
  flushSegmentTextDrafts as flushSegmentTextDraftsImpl,
  syncDomTextareasFromSegments,
} from "./flushSegmentTextDrafts";
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
  ) => void;
  flushSegmentTextDrafts: () => void;
  resetMutationHistory: () => void;
}

type SegmentMutationDeps = {
  segmentsRef: React.MutableRefObject<SegmentDto[]>;
  setSegments: React.Dispatch<React.SetStateAction<SegmentDto[]>>;
  selectedIdxRef: React.MutableRefObject<number>;
  setSelectedIdx: React.Dispatch<React.SetStateAction<number>>;
  setError: (msg: string) => void;
  busy: boolean;
  pendingAiRevisedUidsRef?: React.MutableRefObject<Set<string>>;
  onSelectionCollapsed?: (idx: number) => void;
};

export function useSegmentMutationController(deps: SegmentMutationDeps): SegmentMutationApi {
  const {
    segmentsRef,
    setSegments,
    selectedIdxRef,
    setSelectedIdx,
    setError,
    busy,
    pendingAiRevisedUidsRef,
    onSelectionCollapsed,
  } = deps;

  const segmentBoundsLiveGestureRef = useRef(false);

  const undoRedo = useSegmentUndoRedo(segmentsRef, setSegments);

  const { pushUndo, pushUndoForTextEdit, undo: undoStackPop, redo: redoStackPop } = undoRedo;

  const flushSegmentTextDrafts = useCallback(() => {
    flushSegmentTextDraftsImpl(segmentsRef, setSegments, {
      beforeApplyUpdates: (updates) => {
        for (const { idx } of updates) {
          pushUndoForTextEdit(idx);
        }
      },
    });
  }, [segmentsRef, setSegments, pushUndoForTextEdit]);

  const undo = useCallback(() => {
    if (busy) return;
    syncDomTextareasFromSegments(segmentsRef.current);
    segmentDraftStore.discardEditingSession();
    undoStackPop();
  }, [busy, segmentsRef, undoStackPop]);

  const redo = useCallback(() => {
    if (busy) return;
    syncDomTextareasFromSegments(segmentsRef.current);
    segmentDraftStore.discardEditingSession();
    redoStackPop();
  }, [busy, segmentsRef, redoStackPop]);

  const mergeDelete = useMemo(
    () =>
      createSegmentMergeDeleteActions({
        segmentsRef,
        setSegments,
        selectedIdxRef,
        setSelectedIdx,
        setError,
        pushUndo,
        onSelectionCollapsed,
      }),
    [
      segmentsRef,
      setSegments,
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
        segmentsRef,
        setSegments,
        setSelectedIdx,
        setError,
        pushUndo,
        flushSegmentTextDrafts,
        onSelectionCollapsed,
      }),
    [
      busy,
      segmentsRef,
      setSegments,
      setSelectedIdx,
      setError,
      pushUndo,
      flushSegmentTextDrafts,
      onSelectionCollapsed,
    ],
  );

  const splits = useSegmentSplitController({
    segmentsRef,
    setSegments,
    setSelectedIdx,
    setError,
    pushUndo,
    flushSegmentTextDrafts,
    onSelectionCollapsed,
  });

  const updateSegmentText = useCallback(
    (idx: number, text: string, options?: { fromLlm?: boolean }) => {
      if (busy) return;
      const prev = segmentsRef.current;
      const cur = prev[idx];
      if (!cur || cur.text === text) return;
      pushUndoForTextEdit(idx);
      const uid = cur.uid?.trim();
      if (!options?.fromLlm && uid && pendingAiRevisedUidsRef) {
        pendingAiRevisedUidsRef.current.delete(uid);
      }
      const nextRow = { ...cur, text };
      const patched = options?.fromLlm ? withAiRevisedStage(nextRow) : nextRow;
      const out = [...prev];
      out[idx] = patched;
      segmentsRef.current = out;
      setSegments(out);
      if (options?.fromLlm && uid && pendingAiRevisedUidsRef) {
        pendingAiRevisedUidsRef.current.add(uid);
      }
    },
    [busy, segmentsRef, setSegments, pushUndoForTextEdit, pendingAiRevisedUidsRef],
  );

  const updateSegmentTime = useCallback(
    (idx: number, field: "start_sec" | "end_sec", value: number) => {
      pushUndo();
      setSegments((prev) => prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
    },
    [pushUndo, setSegments],
  );

  const updateSegmentBounds = useCallback(
    (idx: number, startSec: number, endSec: number, phase: "live" | "commit" = "commit") => {
      const prev = segmentsRef.current;
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
        setSegments((p) => p.map((x, i) => (i === idx ? { ...x, start_sec: lo, end_sec: hi } : x)));
        return;
      }

      const hadLiveGesture = segmentBoundsLiveGestureRef.current;
      segmentBoundsLiveGestureRef.current = false;
      if (!hadLiveGesture) pushUndo();
      setSegments((p) => p.map((x, i) => (i === idx ? { ...x, start_sec: lo, end_sec: hi } : x)));
    },
    [segmentsRef, setSegments, pushUndo],
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
    flushSegmentTextDrafts,
    resetMutationHistory: undoRedo.reset,
  };
}
