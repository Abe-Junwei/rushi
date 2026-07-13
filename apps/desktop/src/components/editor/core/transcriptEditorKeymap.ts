import { EditorState, Annotation } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import type { EditorView } from "@codemirror/view";
import { movePrimarySegmentCommand } from "./selectionCommands";
import { primarySegmentIdx } from "./selectionField";

/** Mark structure transactions that may change line count (P6). */
export const transcriptStructureEditAnnotation = Annotation.define<boolean>();

/**
 * Keep one line per segment: reject user transactions that change line count.
 * Structure edits (P6) must attach {@link transcriptStructureEditAnnotation}.
 */
export const transcriptLineCountGuard = EditorState.transactionFilter.of((tr) => {
  if (!tr.docChanged) return tr;
  if (tr.annotation(transcriptStructureEditAnnotation)) return tr;
  if (tr.startState.doc.lines === tr.newDoc.lines) return tr;
  return [];
});

export type TranscriptPrimaryMovedHandler = (
  idx: number,
  opts: { shiftKey?: boolean },
) => void;

export type TranscriptEditorKeymapOptions = {
  /**
   * Transitional P3→P5: notify host (SC1/waveform seek) when ↑/↓ changes primary.
   * Remove once waveform reads transcriptProjection only.
   */
  onPrimaryMoved?: TranscriptPrimaryMovedHandler;
};

/**
 * Segment-level ↑/↓ (syncs multi-select field) + Enter swallow.
 * Prefer this over bare CM6 caret moves so selectedSet does not ghost.
 */
export function runTranscriptArrowMove(
  view: EditorView,
  delta: -1 | 1,
  opts: { shiftKey?: boolean; onPrimaryMoved?: TranscriptPrimaryMovedHandler } = {},
): boolean {
  if (!movePrimarySegmentCommand(view, delta, { shiftKey: opts.shiftKey })) return false;
  const idx = primarySegmentIdx(view.state);
  if (idx >= 0) opts.onPrimaryMoved?.(idx, { shiftKey: opts.shiftKey });
  return true;
}

export function createTranscriptEditorKeymap(
  opts: TranscriptEditorKeymapOptions = {},
) {
  const onPrimaryMoved = opts.onPrimaryMoved;
  return keymap.of([
    // Enter must not insert a newline (would break line↔segment invariant).
    // Confirm-advance is handled by the capture-phase editor shortcut dispatcher.
    { key: "Enter", run: () => true },
    { key: "Shift-Enter", run: () => true },
    { key: "Mod-Enter", run: () => true },
    {
      key: "ArrowUp",
      run: (view) => runTranscriptArrowMove(view, -1, { onPrimaryMoved }),
    },
    {
      key: "ArrowDown",
      run: (view) => runTranscriptArrowMove(view, 1, { onPrimaryMoved }),
    },
    {
      key: "Shift-ArrowUp",
      run: (view) =>
        runTranscriptArrowMove(view, -1, { shiftKey: true, onPrimaryMoved }),
    },
    {
      key: "Shift-ArrowDown",
      run: (view) =>
        runTranscriptArrowMove(view, 1, { shiftKey: true, onPrimaryMoved }),
    },
  ]);
}

/** Default keymap without host bridge (unit tests / spike). */
export const transcriptEditorKeymap = createTranscriptEditorKeymap();
