import { RangeSetBuilder, StateField } from "@codemirror/state";
import type { EditorState } from "@codemirror/state";
import { Decoration, EditorView } from "@codemirror/view";
import type { DecorationSet } from "@codemirror/view";
import {
  primarySegmentIdx,
  transcriptMultiSelectionField,
  transcriptMultiSelectionEqual,
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
 *
 * Rebuild on doc changes: zero-length line decorations at `line.from` are not
 * reliable under `RangeSet.map` (typing at line start can drop the class while
 * gutters still show primary from live `primarySegmentIdx`).
 */
export const transcriptSelectionDecorations = StateField.define<DecorationSet>({
  create(state) {
    return buildSelectionDecorations(state);
  },
  update(_value, tr) {
    const selectionChanged =
      primarySegmentIdx(tr.startState) !== primarySegmentIdx(tr.state);
    const multiChanged =
      !transcriptMultiSelectionEqual(
        tr.startState.field(transcriptMultiSelectionField),
        tr.state.field(transcriptMultiSelectionField),
      );
    if (selectionChanged || multiChanged || tr.docChanged) {
      return buildSelectionDecorations(tr.state);
    }
    return _value;
  },
  provide: (f) => EditorView.decorations.from(f),
});
