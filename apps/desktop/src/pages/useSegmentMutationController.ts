import { useCallback, useRef } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import { createSegmentUid, mergeTwoSegments, reindexSegments } from "./segmentListHelpers";
import { flushSegmentTextDrafts as flushSegmentTextDraftsImpl } from "./flushSegmentTextDrafts";
import { useSegmentSplitController } from "./useSegmentSplitController";
import { useSegmentUndoRedo } from "./useSegmentUndoRedo";

function roundSec3(x: number): number {
  return Math.round(x * 1000) / 1000;
}

export interface SegmentMutationApi {
  pushUndo: () => void;
  undo: () => void;
  redo: () => void;
  updateSegmentText: (idx: number, text: string) => void;
  updateSegmentTime: (idx: number, field: "start_sec" | "end_sec", value: number) => void;
  updateSegmentBounds: (idx: number, startSec: number, endSec: number, phase?: "live" | "commit") => void;
  splitAtSelection: (selectedIdx: number) => void;
  splitAtPlayhead: (timeSec: number) => void;
  mergeWithPrev: (selectedIdx: number) => void;
  mergeWithNext: (selectedIdx: number) => void;
  mergeWithPrevAt: (idx: number) => void;
  mergeWithNextAt: (idx: number) => void;
  deleteSegmentAt: (idx: number) => void;
  insertSegmentAfter: (idx: number) => void;
  insertSegmentFromTimeRange: (startSec: number, endSec: number) => void;
  flushSegmentTextDrafts: () => void;
  resetMutationHistory: () => void;
}

export interface SegmentMutationDeps {
  segmentsRef: React.MutableRefObject<SegmentDto[]>;
  setSegments: React.Dispatch<React.SetStateAction<SegmentDto[]>>;
  selectedIdxRef: React.MutableRefObject<number>;
  setSelectedIdx: React.Dispatch<React.SetStateAction<number>>;
  setError: (msg: string) => void;
  busy: boolean;
}

export function useSegmentMutationController(deps: SegmentMutationDeps): SegmentMutationApi {
  const { segmentsRef, setSegments, setSelectedIdx, setError, busy } = deps;
  void deps.selectedIdxRef;

  const segmentBoundsLiveGestureRef = useRef(false);

  const undoRedo = useSegmentUndoRedo(segmentsRef, setSegments);

  const { pushUndo, pushUndoForTextEdit, undo, redo } = undoRedo;

  const flushSegmentTextDrafts = useCallback(() => {
    flushSegmentTextDraftsImpl(segmentsRef, setSegments);
  }, [segmentsRef, setSegments]);

  const splits = useSegmentSplitController({
    segmentsRef,
    setSegments,
    setSelectedIdx,
    setError,
    pushUndo,
    flushSegmentTextDrafts,
  });

  const updateSegmentText = useCallback(
    (idx: number, text: string) => {
      const prev = segmentsRef.current;
      const cur = prev[idx];
      if (!cur || cur.text === text) return;
      pushUndoForTextEdit(idx);
      setSegments((p) => {
        const c = p[idx];
        if (!c || c.text === text) return p;
        const out = [...p];
        out[idx] = { ...c, text };
        return out;
      });
    },
    [segmentsRef, setSegments, pushUndoForTextEdit],
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
      if (prevSeg) lo = Math.max(lo, prevSeg.end_sec + 1e-6);
      if (nextSeg) hi = Math.min(hi, nextSeg.start_sec - 1e-6);
      lo = roundSec3(lo);
      hi = roundSec3(hi);
      if (hi <= lo + 0.02) {
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
    },
    [flushSegmentTextDrafts, segmentsRef, setSegments, setSelectedIdx, pushUndo],
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
    },
    [flushSegmentTextDrafts, segmentsRef, setSegments, setSelectedIdx, pushUndo],
  );

  const mergeWithPrev = (selectedIdx: number) => mergeWithPrevAt(selectedIdx);
  const mergeWithNext = (selectedIdx: number) => mergeWithNextAt(selectedIdx);

  const deleteSegmentAt = useCallback(
    (idx: number) => {
      flushSegmentTextDrafts();
      const segs = segmentsRef.current;
      if (idx < 0 || idx >= segs.length) return;
      setError("");
      pushUndo();
      setSegments((prev) => reindexSegments(prev.filter((_, j) => j !== idx)));
      setSelectedIdx((prev) => {
        const nextLen = segs.length - 1;
        if (nextLen <= 0) return 0;
        let next = prev;
        if (idx < prev) next -= 1;
        else if (idx === prev) next = Math.min(prev, nextLen - 1);
        return Math.max(0, Math.min(next, nextLen - 1));
      });
    },
    [flushSegmentTextDrafts, segmentsRef, setSegments, setSelectedIdx, setError, pushUndo],
  );

  const insertSegmentAfter = useCallback(
    (idx: number) => {
      flushSegmentTextDrafts();
      const segs = segmentsRef.current;
      if (idx < 0 || idx >= segs.length) return;
      const a = segs[idx];
      const b = segs[idx + 1];
      if (!a) return;
      const startSec = a.end_sec;
      let endSec: number;
      if (b) {
        const gap = b.start_sec - a.end_sec;
        if (!Number.isFinite(gap) || gap < 0.12) {
          setError("与下一条无足够间隙：请在波形区拖动语段边界留出空档后再插入。");
          return;
        }
        endSec = a.end_sec + Math.min(Math.max(gap * 0.45, 0.08), 2);
      } else {
        endSec = a.end_sec + 1;
      }
      if (endSec <= startSec + 0.04) {
        setError("无法插入：时间范围无效。");
        return;
      }
      setError("");
      pushUndo();
      const newSeg: SegmentDto = {
        uid: createSegmentUid(),
        idx: 0,
        start_sec: startSec,
        end_sec: endSec,
        text: "",
        confidence: null,
        low_confidence: false,
        detail: null,
      };
      setSegments((prev) => {
        const out = [...prev.slice(0, idx + 1), newSeg, ...prev.slice(idx + 1)];
        return reindexSegments(out);
      });
      setSelectedIdx(idx + 1);
    },
    [flushSegmentTextDrafts, segmentsRef, setSegments, setSelectedIdx, setError, pushUndo],
  );

  const insertSegmentFromTimeRange = useCallback(
    (startSec: number, endSec: number) => {
      if (busy) return;
      flushSegmentTextDrafts();
      const lo = roundSec3(Math.min(startSec, endSec));
      const hi = roundSec3(Math.max(startSec, endSec));
      if (hi <= lo + 0.05) {
        setError("选区过短。");
        return;
      }
      const segs = segmentsRef.current;
      for (const s of segs) {
        if (lo < s.end_sec && hi > s.start_sec) {
          setError("选区与已有语段重叠。");
          return;
        }
      }
      setError("");
      pushUndo();
      let insertAt = segs.findIndex((s) => s.start_sec > lo);
      if (insertAt === -1) insertAt = segs.length;
      const newSeg: SegmentDto = {
        uid: createSegmentUid(),
        idx: 0,
        start_sec: lo,
        end_sec: hi,
        text: "",
        confidence: null,
        low_confidence: false,
        detail: null,
      };
      setSegments((prev) => {
        const out = [...prev.slice(0, insertAt), newSeg, ...prev.slice(insertAt)];
        return reindexSegments(out);
      });
      setSelectedIdx(insertAt);
    },
    [busy, flushSegmentTextDrafts, segmentsRef, setSegments, setSelectedIdx, setError, pushUndo],
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
    deleteSegmentAt,
    insertSegmentAfter,
    insertSegmentFromTimeRange,
    flushSegmentTextDrafts,
    resetMutationHistory: undoRedo.reset,
  };
}
