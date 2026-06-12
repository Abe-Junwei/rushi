import { useCallback, useRef } from "react";
import type { SegmentDto } from "../tauri/projectApi";

function cloneSegments(segs: SegmentDto[]): SegmentDto[] {
  return segs.map((s) => ({ ...s }));
}

export interface SegmentUndoRedoApi {
  pushUndo: () => void;
  pushUndoForTextEdit: (idx: number) => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
}

export function useSegmentUndoRedo(
  segmentsRef: React.MutableRefObject<SegmentDto[]>,
  setSegments: React.Dispatch<React.SetStateAction<SegmentDto[]>>,
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
    undoStack.current.push(cloneSegments(segmentsRef.current));
    if (undoStack.current.length > 40) undoStack.current.shift();
  }, [segmentsRef]);

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

  const undo = useCallback(() => {
    const prev = undoStack.current.pop();
    if (!prev) return;
    redoStack.current.push(cloneSegments(segmentsRef.current));
    if (redoStack.current.length > 40) redoStack.current.shift();
    textEditUndoRef.current = null;
    segmentsRef.current = prev;
    setSegments(prev);
  }, [segmentsRef, setSegments]);

  const redo = useCallback(() => {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push(cloneSegments(segmentsRef.current));
    if (undoStack.current.length > 40) undoStack.current.shift();
    textEditUndoRef.current = null;
    segmentsRef.current = next;
    setSegments(next);
  }, [segmentsRef, setSegments]);

  return { pushUndo, pushUndoForTextEdit, undo, redo, reset };
}
