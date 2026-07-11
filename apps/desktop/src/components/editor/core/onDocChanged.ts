import type { Extension } from "@codemirror/state";
import { EditorView, type ViewUpdate } from "@codemirror/view";
import type { SegmentDto } from "../../../tauri/projectTypes";
import { serializeTranscriptEditorState } from "./serializeTranscriptEditorState";
import { getTranscriptEditorView } from "./transcriptEditorViewHandle";
import { decodeDocLineToSegmentText } from "./segmentNewlineCodec";

export type OnDocChangedHandlers = {
  /**
   * Apply text-only projection. Called debounced after doc changes that keep line count.
   * Caller should map into updateSegmentText / dirty / autosave / undo.
   */
  onTextLinesProjected: (segments: SegmentDto[]) => void;
  /**
   * Fast path for live typing. Receives only changed doc lines, avoiding a
   * whole-transcript serialize/diff on every IME commit. When provided, this
   * handler owns the text-only path and onTextLinesProjected is only fallback.
   */
  onTextLineProjected?: (idx: number, text: string) => void;
  debounceMs?: number;
};

type PendingProjection = {
  timer: ReturnType<typeof setTimeout> | null;
  run: () => void;
};

let pendingProjection: PendingProjection | null = null;
let pendingTextLineIdxs: Set<number> | null = null;

/**
 * Clears only the timer half of the pending state. Keep pendingTextLineIdxs so
 * debounce rollovers and IME composition can preserve accumulated line indices.
 */
function cancelPendingProjectionTimer(): void {
  if (!pendingProjection) return;
  if (pendingProjection.timer) clearTimeout(pendingProjection.timer);
  pendingProjection = null;
}

/** Cancel a pending debounced onDocChanged flush without applying. */
export function cancelPendingOnDocChangedFlush(): void {
  cancelPendingProjectionTimer();
  pendingTextLineIdxs = null;
}

/** Apply a pending debounced projection immediately (if any). */
export function flushPendingOnDocChangedProjection(): void {
  if (!pendingProjection) return;
  const { run } = pendingProjection;
  if (pendingProjection.timer) clearTimeout(pendingProjection.timer);
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

  const scheduleProjection = (view: EditorView, run: () => void) => {
    cancelPendingProjectionTimer();
    if (view.composing) {
      pendingProjection = { timer: null, run };
      return;
    }
    pendingProjection = {
      timer: setTimeout(run, debounceMs),
      run,
    };
  };

  return [
    EditorView.updateListener.of((update) => {
      if (!update.docChanged) return;
      if (update.startState.doc.lines !== update.state.doc.lines) {
        // Structure change — P6 path; do not debounce as text-only.
        return;
      }
      const changedLineIdxs = collectChangedLineIdxs(update);
      if (handlers.onTextLineProjected) {
        pendingTextLineIdxs ??= new Set<number>();
        for (const idx of changedLineIdxs) pendingTextLineIdxs.add(idx);
      }
      const run = () => {
        pendingProjection = null;
        if (handlers.onTextLineProjected) {
          const lineIdxs = [...(pendingTextLineIdxs ?? changedLineIdxs)].sort((a, b) => a - b);
          pendingTextLineIdxs = null;
          for (const idx of lineIdxs) {
          // Read live state at flush time, not the transaction snapshot.
            const line = update.view.state.doc.line(idx + 1);
            handlers.onTextLineProjected(idx, decodeDocLineToSegmentText(line.text));
          }
          return;
        }
        const segments = serializeTranscriptEditorState(update.view.state);
        const key = segments.map((s) => s.text).join("\u0000");
        if (key === lastSerialized) return;
        lastSerialized = key;
        handlers.onTextLinesProjected(segments);
      };
      scheduleProjection(update.view, run);
    }),
    EditorView.domEventHandlers({
      compositionend(_event, _view) {
        if (!pendingProjection || pendingProjection.timer) return false;
        window.setTimeout(() => {
          flushPendingOnDocChangedProjection();
        }, 25);
        return false;
      },
    }),
  ];
}

function collectChangedLineIdxs(update: ViewUpdate): number[] {
  const out = new Set<number>();
  update.changes.iterChangedRanges((_fromA, _toA, fromB, toB) => {
    const fromLine = update.state.doc.lineAt(fromB).number;
    const toLine = update.state.doc.lineAt(Math.max(fromB, toB - 1)).number;
    for (let lineNo = fromLine; lineNo <= toLine; lineNo++) {
      out.add(lineNo - 1);
    }
  });
  return [...out].filter((idx) => idx >= 0 && idx < update.state.doc.lines);
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
  // If called mid-IME composition, this serializes CM6's best available
  // intermediate text. Normal typing projection is deferred until compositionend.
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
