import {
  EditorSelection,
  EditorState,
  StateEffect,
  StateField,
  type Extension,
  type Text,
  type Transaction,
  type TransactionSpec,
} from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { shouldConsumeTranscriptContentMousedown } from "./selectionCommands";
import { primarySegmentIdx } from "./selectionField";

/** 1-based doc line locked for the active plain text-drag, or null when idle. */
export const setTranscriptTextDragLineEffect = StateEffect.define<number | null>();

export const transcriptTextDragLineField = StateField.define<number | null>({
  create: () => null,
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(setTranscriptTextDragLineEffect)) return e.value;
    }
    return value;
  },
});

/**
 * Clamp an EditorSelection so both ends stay on the given 1-based doc line.
 * Used to keep same-segment text drag-select from spilling into neighbor segments.
 */
export function clampEditorSelectionToDocLine(
  doc: Text,
  selection: EditorSelection,
  lineNumber: number,
): EditorSelection {
  if (lineNumber < 1 || lineNumber > doc.lines) return selection;
  const line = doc.line(lineNumber);
  const main = selection.main;
  const anchorLine = doc.lineAt(main.anchor).number;
  const headLine = doc.lineAt(main.head).number;
  if (anchorLine === lineNumber && headLine === lineNumber) return selection;

  const clampPos = (pos: number) => Math.min(Math.max(pos, line.from), line.to);
  const anchor = clampPos(main.anchor);
  const head = clampPos(main.head);
  if (anchor === head) return EditorSelection.single(anchor);
  // Preserve drag direction: range(anchor, head) keeps which end is the head.
  return EditorSelection.create([EditorSelection.range(anchor, head)]);
}

export function selectionCrossesDocLine(
  doc: Text,
  selection: EditorSelection,
  lineNumber: number,
): boolean {
  const main = selection.main;
  return (
    doc.lineAt(main.anchor).number !== lineNumber ||
    doc.lineAt(main.head).number !== lineNumber
  );
}

function resolveDragLineFromTransaction(tr: Transaction): number | null {
  let lineNumber = tr.startState.field(transcriptTextDragLineField);
  for (const e of tr.effects) {
    if (e.is(setTranscriptTextDragLineEffect)) lineNumber = e.value;
  }
  return lineNumber;
}

/** Pure filter body — exported for focused tests. */
export function filterTransactionForTextDragClamp(
  tr: Transaction,
): Transaction | readonly TransactionSpec[] {
  if (!tr.selection) return tr;
  const lineNumber = resolveDragLineFromTransaction(tr);
  if (lineNumber == null) return tr;
  if (!selectionCrossesDocLine(tr.newDoc, tr.newSelection, lineNumber)) return tr;
  const clamped = clampEditorSelectionToDocLine(tr.newDoc, tr.newSelection, lineNumber);
  if (clamped.eq(tr.newSelection)) return tr;
  return [tr, { selection: clamped, filter: false }];
}

/**
 * While the primary button is down on same-segment content (plain click),
 * clamp CM selection updates to the mousedown doc line so vertical slop /
 * edge autoscroll cannot extend text selection into neighbor segments.
 */
export function createTranscriptTextDragClamp(): Extension[] {
  let activeView: EditorView | null = null;
  let windowUpBound = false;

  const clearDragOnView = (view: EditorView | null) => {
    if (!view || view.state.field(transcriptTextDragLineField) == null) return;
    view.dispatch({ effects: setTranscriptTextDragLineEffect.of(null) });
  };

  const onWindowUp = () => {
    clearDragOnView(activeView);
    activeView = null;
    if (windowUpBound && typeof window !== "undefined") {
      window.removeEventListener("mouseup", onWindowUp);
      window.removeEventListener("blur", onWindowUp);
      windowUpBound = false;
    }
  };

  const bindWindowUp = (view: EditorView) => {
    activeView = view;
    if (windowUpBound || typeof window === "undefined") return;
    window.addEventListener("mouseup", onWindowUp);
    window.addEventListener("blur", onWindowUp);
    windowUpBound = true;
  };

  return [
    transcriptTextDragLineField,
    EditorView.domEventHandlers({
      mousedown(event, view) {
        if (event.button !== 0) {
          clearDragOnView(view);
          return false;
        }
        const toggle = event.metaKey || event.ctrlKey;
        const shiftKey = event.shiftKey;
        if (shiftKey || toggle) {
          clearDragOnView(view);
          return false;
        }
        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
        if (pos == null) {
          clearDragOnView(view);
          return false;
        }
        const line = view.state.doc.lineAt(pos);
        const idx = line.number - 1;
        const primary = primarySegmentIdx(view.state);
        if (
          shouldConsumeTranscriptContentMousedown({
            clickedIdx: idx,
            primaryIdx: primary,
            shiftKey: false,
            toggle: false,
          })
        ) {
          clearDragOnView(view);
          return false;
        }
        view.dispatch({ effects: setTranscriptTextDragLineEffect.of(line.number) });
        bindWindowUp(view);
        return false;
      },
      mouseup(_event, view) {
        clearDragOnView(view);
        activeView = null;
        if (windowUpBound && typeof window !== "undefined") {
          window.removeEventListener("mouseup", onWindowUp);
          window.removeEventListener("blur", onWindowUp);
          windowUpBound = false;
        }
        return false;
      },
    }),
    EditorState.transactionFilter.of(filterTransactionForTextDragClamp),
  ];
}
