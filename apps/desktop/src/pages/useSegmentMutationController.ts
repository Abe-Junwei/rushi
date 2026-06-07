import { useCallback, useRef } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import { createSegmentUid, mergeTwoSegments, reindexSegments } from "./segmentListHelpers";
import { newUserCreatedSegment } from "../services/segmentTextStage";
import { withAiRevisedStage } from "../services/segmentStagePersist";
import { segmentDraftStore } from "../hooks/useSegmentDraftStore";
import { flushSegmentTextDrafts as flushSegmentTextDraftsImpl } from "./flushSegmentTextDrafts";
import {
  describeCreateRangePolicyFailure,
  resolveCreateRangeForPolicy,
  type SegmentOverlapPolicy,
} from "../utils/segmentTimeRange";
import {
  clampSegmentBoundsToNeighbors,
  findSegmentInsertIndexByStart,
  resolveInsertAfterSpan,
  segmentBoundsMeetMinSpan,
  SEGMENT_BOUNDS_LIVE_MIN_SPAN_SEC,
} from "../utils/segmentGapPolicy";
import {
  clampSegmentTimeBounds,
  selectPackableSegments,
  WAVEFORM_SEGMENT_MIN_SPAN_SEC,
} from "../utils/waveformSegmentBounds";
import { mergeSegmentRangeFold } from "../utils/segmentSelection";
import { useSegmentSplitController } from "./useSegmentSplitController";
import { useSegmentUndoRedo } from "./useSegmentUndoRedo";

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
  insertSegmentAfter: (idx: number, mediaDurationSec?: number) => void;
  insertSegmentFromTimeRange: (
    startSec: number,
    endSec: number,
    mediaDurationSec?: number,
    policy?: SegmentOverlapPolicy,
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
    flushSegmentTextDrafts();
    undoStackPop();
    segmentDraftStore.discardEditingSession();
  }, [busy, flushSegmentTextDrafts, undoStackPop]);

  const redo = useCallback(() => {
    if (busy) return;
    flushSegmentTextDrafts();
    redoStackPop();
    segmentDraftStore.discardEditingSession();
  }, [busy, flushSegmentTextDrafts, redoStackPop]);

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
      setSegments((p) => {
        const c = p[idx];
        if (!c || c.text === text) return p;
        const out = [...p];
        const nextRow = { ...c, text };
        out[idx] = options?.fromLlm ? withAiRevisedStage(nextRow) : nextRow;
        if (options?.fromLlm && uid && pendingAiRevisedUidsRef) {
          pendingAiRevisedUidsRef.current.add(uid);
        }
        return out;
      });
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

  const mergeWithPrevAt = useCallback(
    (idx: number) => {
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
    },
    [flushSegmentTextDrafts, onSelectionCollapsed, segmentsRef, setSegments, setSelectedIdx, pushUndo],
  );

  const mergeWithNextAt = useCallback(
    (idx: number) => {
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
    },
    [flushSegmentTextDrafts, onSelectionCollapsed, segmentsRef, setSegments, setSelectedIdx, pushUndo],
  );

  const mergeWithPrev = (selectedIdx: number) => mergeWithPrevAt(selectedIdx);
  const mergeWithNext = (selectedIdx: number) => mergeWithNextAt(selectedIdx);

  const mergeSegmentRange = useCallback(
    (lo: number, hi: number) => {
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
    },
    [flushSegmentTextDrafts, onSelectionCollapsed, pushUndo, segmentsRef, setSegments, setSelectedIdx],
  );

  const deleteSegmentAt = useCallback(
    (idx: number) => {
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
    },
    [flushSegmentTextDrafts, onSelectionCollapsed, pushUndo, segmentsRef, selectedIdxRef, setError, setSegments, setSelectedIdx],
  );

  const deleteSegmentRange = useCallback(
    (lo: number, hi: number) => {
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
    },
    [flushSegmentTextDrafts, onSelectionCollapsed, pushUndo, segmentsRef, selectedIdxRef, setError, setSegments, setSelectedIdx],
  );

  const insertSegmentAfter = useCallback(
    (idx: number, mediaDurationSec = 0) => {
      flushSegmentTextDrafts();
      const segs = segmentsRef.current;
      if (idx < 0 || idx >= segs.length) return;
      const a = segs[idx];
      const b = segs[idx + 1];
      if (!a) return;
      const span = resolveInsertAfterSpan({
        prevEndSec: a.end_sec,
        nextStartSec: b?.start_sec,
        mediaDurationSec: mediaDurationSec > 0 ? mediaDurationSec : undefined,
      });
      if (!span.ok) {
        setError(
          span.reason === "gap-too-small"
            ? "与下一条无足够间隙：请在波形区拖动语段边界留出空档后再插入。"
            : "无法插入：时间范围无效。",
        );
        return;
      }
      const { startSec, endSec } = span;
      setError("");
      pushUndo();
      const newSeg: SegmentDto = newUserCreatedSegment({
        uid: createSegmentUid(),
        idx: 0,
        start_sec: startSec,
        end_sec: endSec,
        text: "",
        confidence: null,
        low_confidence: false,
        detail: null,
        kind: "speech",
      });
      setSegments((prev) => {
        const out = [...prev.slice(0, idx + 1), newSeg, ...prev.slice(idx + 1)];
        return reindexSegments(out);
      });
      const nextIdx = idx + 1;
      setSelectedIdx(nextIdx);
      onSelectionCollapsed?.(nextIdx);
    },
    [flushSegmentTextDrafts, onSelectionCollapsed, segmentsRef, setSegments, setSelectedIdx, setError, pushUndo],
  );

  const insertSegmentFromTimeRange = useCallback(
    (
      startSec: number,
      endSec: number,
      mediaDurationSec = 0,
      policy: SegmentOverlapPolicy = "trim",
    ) => {
      if (busy) return;
      flushSegmentTextDrafts();
      let lo = roundSec3(Math.min(startSec, endSec));
      let hi = roundSec3(Math.max(startSec, endSec));
      if (mediaDurationSec > 0) {
        ({ startSec: lo, endSec: hi } = clampSegmentTimeBounds(lo, hi, mediaDurationSec));
      }
      if (hi - lo < WAVEFORM_SEGMENT_MIN_SPAN_SEC) {
        setError(mediaDurationSec > 0 && hi <= lo ? "选区超出媒体时长。" : "选区过短。");
        return;
      }
      const segs = segmentsRef.current;
      // 重叠检测必须只看「波形上真实可见」的语段：整轨占位语段（dominant span）不渲染，
      // 走同一个 selectPackableSegments 真源，确保与 overlay / lane / 命中测试判定一致，
      // 否则空白区域会永远误报「选区与已有语段重叠」。
      const overlapSegs = selectPackableSegments(segs, mediaDurationSec);
      const clamped = resolveCreateRangeForPolicy(overlapSegs, lo, hi, policy);
      if (!clamped) {
        setError(describeCreateRangePolicyFailure(policy, lo, hi, overlapSegs));
        return;
      }
      let { startSec: fitLo, endSec: fitHi } = clamped;
      if (mediaDurationSec > 0) {
        ({ startSec: fitLo, endSec: fitHi } = clampSegmentTimeBounds(fitLo, fitHi, mediaDurationSec));
        if (fitHi - fitLo < WAVEFORM_SEGMENT_MIN_SPAN_SEC) {
          setError("选区超出媒体时长。");
          return;
        }
      }
      setError("");
      pushUndo();
      const insertAt = findSegmentInsertIndexByStart(segs, fitLo);
      const newSeg: SegmentDto = newUserCreatedSegment({
        uid: createSegmentUid(),
        idx: 0,
        start_sec: fitLo,
        end_sec: fitHi,
        text: "",
        confidence: null,
        low_confidence: false,
        detail: null,
        kind: "speech",
      });
      setSegments((prev) => {
        const out = [...prev.slice(0, insertAt), newSeg, ...prev.slice(insertAt)];
        return reindexSegments(out);
      });
      setSelectedIdx(insertAt);
      onSelectionCollapsed?.(insertAt);
    },
    [busy, flushSegmentTextDrafts, onSelectionCollapsed, segmentsRef, setSegments, setSelectedIdx, setError, pushUndo],
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
    mergeWithPrev,
    mergeWithNext,
    mergeWithPrevAt,
    mergeWithNextAt,
    mergeSegmentRange,
    deleteSegmentAt,
    deleteSegmentRange,
    insertSegmentAfter,
    insertSegmentFromTimeRange,
    flushSegmentTextDrafts,
    resetMutationHistory: undoRedo.reset,
  };
}
