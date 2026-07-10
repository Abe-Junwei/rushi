import { useCallback, useRef } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import type { SegmentListNext } from "./flushSegmentTextDrafts";
import { getTranscriptProjectionSnapshot } from "../components/editor/core/transcriptProjection";
import { dispatchTranscriptApplySegments } from "../components/editor/core/transcriptEditorViewHandle";

function cloneSegments(segs: SegmentDto[]): SegmentDto[] {
  return segs.map((s) => ({ ...s }));
}

function primaryIdxForRestore(segmentCount: number): number {
  const primary = getTranscriptProjectionSnapshot().primaryIdx;
  if (primary >= 0 && (segmentCount <= 0 || primary < segmentCount)) return primary;
  return segmentCount > 0 ? 0 : 0;
}

export interface SegmentUndoRedoApi {
  pushUndo: () => void;
  pushUndoForTextEdit: (idx: number) => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
}

export function useSegmentUndoRedo(
  publishTextBulk: (next: SegmentListNext) => void,
  getCurrentSegmentsSnapshot: () => SegmentDto[],
): SegmentUndoRedoApi {
  const undoStack = useRef<SegmentDto[][]>([]);
  const redoStack = useRef<SegmentDto[][]>([]);
  const textEditUndoRef = useRef<{ idx: number; atMs: number } | null>(null);

  const reset = useCallback(() => {
    undoStack.current = [];
    redoStack.current = [];
    textEditUndoRef.current = null;
  }, []);

  const pushUndo = useCallback(() => {
    redoStack.current = [];
    undoStack.current.push(cloneSegments(getCurrentSegmentsSnapshot()));
    if (undoStack.current.length > 40) undoStack.current.shift();
  }, [getCurrentSegmentsSnapshot]);

  const pushUndoForTextEdit = useCallback(
    (idx: number) => {
      const now = Date.now();
      const prev = textEditUndoRef.current;
      const shouldSnapshot = !prev || prev.idx !== idx || now - prev.atMs > 1200;
      if (shouldSnapshot) pushUndo();
      textEditUndoRef.current = { idx, atMs: now };
    },
    [pushUndo],
  );

  const restoreSnapshot = useCallback(
    (next: SegmentDto[]) => {
      dispatchTranscriptApplySegments(next, primaryIdxForRestore(next.length));
      publishTextBulk(next);
    },
    [publishTextBulk],
  );

  const undo = useCallback(() => {
    const prev = undoStack.current.pop();
    if (!prev) return;
    redoStack.current.push(cloneSegments(getCurrentSegmentsSnapshot()));
    restoreSnapshot(prev);
  }, [getCurrentSegmentsSnapshot, restoreSnapshot]);

  const redo = useCallback(() => {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push(cloneSegments(getCurrentSegmentsSnapshot()));
    restoreSnapshot(next);
  }, [getCurrentSegmentsSnapshot, restoreSnapshot]);

  return { pushUndo, pushUndoForTextEdit, undo, redo, reset };
}
