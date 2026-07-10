import { RangeSetBuilder, StateField } from "@codemirror/state";
import type { EditorState } from "@codemirror/state";
import { Decoration, EditorView } from "@codemirror/view";
import type { DecorationSet } from "@codemirror/view";
import {
  primarySegmentIdx,
  transcriptMultiSelectionField,
} from "./selectionField";

const primaryDeco = Decoration.line({
  attributes: { class: "cm-transcript-primary-line" },
});
const inSelectionDeco = Decoration.line({
  attributes: { class: "cm-transcript-in-selection-line" },
});

function buildSelectionDecorations(state: EditorState): DecorationSet {
  const builder = new RangeSetBuilder<typeof primaryDeco>();
  const primary = primarySegmentIdx(state);
  const { selectedSet } = state.field(transcriptMultiSelectionField);
  const lineCount = state.doc.lines;
  for (let i = 0; i < lineCount; i++) {
    if (!selectedSet.has(i) && i !== primary) continue;
    const line = state.doc.line(i + 1);
    if (i === primary) builder.add(line.from, line.from, primaryDeco);
    else builder.add(line.from, line.from, inSelectionDeco);
  }
  return builder.finish();
}

/**
 * Line decorations for primary / in-selection rows.
 * Driven only by CM6 selection + multi-select field — no React selectedIdx.
 */
export const transcriptSelectionDecorations = StateField.define<DecorationSet>({
  create(state) {
    return buildSelectionDecorations(state);
  },
  update(value, tr) {
    const selectionChanged =
      tr.selection != null && !tr.startState.selection.eq(tr.selection);
    const multiChanged =
      tr.startState.field(transcriptMultiSelectionField) !==
      tr.state.field(transcriptMultiSelectionField);
    if (!tr.docChanged && !selectionChanged && !multiChanged) {
      return value.map(tr.changes);
    }
    return buildSelectionDecorations(tr.state);
  },
  provide: (f) => EditorView.decorations.from(f),
});
