import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import type { SegmentDto } from "../../../tauri/projectTypes";
import { serializeTranscriptEditorState } from "./serializeTranscriptEditorState";
import { getTranscriptEditorView } from "./transcriptEditorViewHandle";

export type OnDocChangedHandlers = {
  /**
   * Apply text-only projection. Called debounced after doc changes that keep line count.
   * Caller should map into updateSegmentText / dirty / autosave / undo.
   */
  onTextLinesProjected: (segments: SegmentDto[]) => void;
  debounceMs?: number;
};

type PendingProjection = {
  timer: ReturnType<typeof setTimeout>;
  run: () => void;
};

let pendingProjection: PendingProjection | null = null;

/** Cancel a pending debounced onDocChanged flush without applying. */
export function cancelPendingOnDocChangedFlush(): void {
  if (!pendingProjection) return;
  clearTimeout(pendingProjection.timer);
  pendingProjection = null;
}

/** Apply a pending debounced projection immediately (if any). */
export function flushPendingOnDocChangedProjection(): void {
  if (!pendingProjection) return;
  const { run } = pendingProjection;
  clearTimeout(pendingProjection.timer);
  pendingProjection = null;
  run();
}

/**
 * Debounced CM6 doc → SegmentDto[] text projection.
 * Complements createTransactionPersistenceBridge; prefer this for live typing.
 */
export function createOnDocChangedBridge(handlers: OnDocChangedHandlers): Extension {
  const debounceMs = handlers.debounceMs ?? 48;
  let lastSerialized: string | null = null;

  return EditorView.updateListener.of((update) => {
    if (!update.docChanged) return;
    if (update.startState.doc.lines !== update.state.doc.lines) {
      // Structure change — P6 path; do not debounce as text-only.
      return;
    }
    cancelPendingOnDocChangedFlush();
    const run = () => {
      pendingProjection = null;
      const segments = serializeTranscriptEditorState(update.view.state);
      const key = segments.map((s) => s.text).join("\u0000");
      if (key === lastSerialized) return;
      lastSerialized = key;
      handlers.onTextLinesProjected(segments);
    };
    pendingProjection = {
      timer: setTimeout(run, debounceMs),
      run,
    };
  });
}

/** Diff projected texts against a baseline and invoke per-index updater. */
export function applyProjectedTextDiff(args: {
  baseline: readonly SegmentDto[];
  projected: readonly SegmentDto[];
  updateSegmentText: (idx: number, text: string) => void;
}): number {
  const n = Math.min(args.baseline.length, args.projected.length);
  let changed = 0;
  for (let i = 0; i < n; i++) {
    const next = args.projected[i]?.text ?? "";
    const prev = args.baseline[i]?.text ?? "";
    if (next === prev) continue;
    args.updateSegmentText(i, next);
    changed += 1;
  }
  return changed;
}

/**
 * Synchronous CM6 → SegmentDto[] text projection (save/export/structure prep).
 * Cancels pending debounce first so the live view is the sole source.
 */
export function flushCm6TextProjection(args: {
  baseline: readonly SegmentDto[];
  updateSegmentText: (idx: number, text: string) => void;
}): number {
  cancelPendingOnDocChangedFlush();
  const view = getTranscriptEditorView();
  if (!view) return 0;
  const projected = serializeTranscriptEditorState(view.state);
  return applyProjectedTextDiff({
    baseline: args.baseline,
    projected,
    updateSegmentText: args.updateSegmentText,
  });
}

/** True while CM6 is in an IME composition session. */
export function isTranscriptEditorComposing(): boolean {
  const view = getTranscriptEditorView();
  return Boolean(view?.composing);
}
