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
  pushExternalAction: (action: ExternalHistoryAction) => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
}

export type ExternalHistoryAction = {
  undo: () => void | Promise<void>;
  redo: () => void | Promise<void>;
};

type HistoryEntry =
  | { kind: "segments"; value: SegmentDto[] }
  | { kind: "external"; action: ExternalHistoryAction };

export function useSegmentUndoRedo(
  publishTextBulk: (next: SegmentListNext) => void,
  getCurrentSegmentsSnapshot: () => SegmentDto[],
): SegmentUndoRedoApi {
  const undoStack = useRef<HistoryEntry[]>([]);
  const redoStack = useRef<HistoryEntry[]>([]);
  const textEditUndoRef = useRef<{ idx: number; atMs: number } | null>(null);

  const reset = useCallback(() => {
    undoStack.current = [];
    redoStack.current = [];
    textEditUndoRef.current = null;
  }, []);

  const pushUndo = useCallback(() => {
    redoStack.current = [];
    undoStack.current.push({ kind: "segments", value: cloneSegments(getCurrentSegmentsSnapshot()) });
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

  const pushExternalAction = useCallback((action: ExternalHistoryAction) => {
    redoStack.current = [];
    undoStack.current.push({ kind: "external", action });
    if (undoStack.current.length > 40) undoStack.current.shift();
  }, []);

  const restoreSnapshot = useCallback(
    (next: SegmentDto[]) => {
      dispatchTranscriptApplySegments(next, primaryIdxForRestore(next.length));
      publishTextBulk(next);
    },
    [publishTextBulk],
  );

  const undo = useCallback(() => {
    const entry = undoStack.current.pop();
    if (!entry) return;
    if (entry.kind === "external") {
      redoStack.current.push(entry);
      void entry.action.undo();
      return;
    }
    redoStack.current.push({ kind: "segments", value: cloneSegments(getCurrentSegmentsSnapshot()) });
    restoreSnapshot(entry.value);
  }, [getCurrentSegmentsSnapshot, restoreSnapshot]);

  const redo = useCallback(() => {
    const entry = redoStack.current.pop();
    if (!entry) return;
    if (entry.kind === "external") {
      undoStack.current.push(entry);
      void entry.action.redo();
      return;
    }
    undoStack.current.push({ kind: "segments", value: cloneSegments(getCurrentSegmentsSnapshot()) });
    restoreSnapshot(entry.value);
  }, [getCurrentSegmentsSnapshot, restoreSnapshot]);

  return { pushUndo, pushUndoForTextEdit, pushExternalAction, undo, redo, reset };
}
