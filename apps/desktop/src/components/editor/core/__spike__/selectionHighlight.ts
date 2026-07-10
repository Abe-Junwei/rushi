import { RangeSetBuilder, StateField } from "@codemirror/state";
import type { EditorState } from "@codemirror/state";
import { Decoration, EditorView } from "@codemirror/view";
import type { DecorationSet } from "@codemirror/view";

const activeLineDeco = Decoration.line({
  attributes: { class: "cm-spike-active-line" },
});

/**
 * Line decoration for the primary selection's line(s).
 * Selection is CM6-native — no React selectedIdx.
 */
export const spikeSelectionHighlight = StateField.define<DecorationSet>({
  create(state) {
    return buildHighlight(state);
  },
  update(value, tr) {
    const selectionChanged =
      tr.selection != null && !tr.startState.selection.eq(tr.selection);
    if (!tr.docChanged && !selectionChanged) return value.map(tr.changes);
    return buildHighlight(tr.state);
  },
  provide: (f) => EditorView.decorations.from(f),
});

function buildHighlight(state: EditorState): DecorationSet {
  const builder = new RangeSetBuilder<typeof activeLineDeco>();
  const { from, to } = state.selection.main;
  const startLine = state.doc.lineAt(from).number;
  const endLine = state.doc.lineAt(to).number;
  for (let n = startLine; n <= endLine; n++) {
    const line = state.doc.line(n);
    builder.add(line.from, line.from, activeLineDeco);
  }
  return builder.finish();
}
