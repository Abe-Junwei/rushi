import { RangeSetBuilder, StateField } from "@codemirror/state";
import type { EditorState } from "@codemirror/state";
import { Decoration, EditorView } from "@codemirror/view";
import type { DecorationSet } from "@codemirror/view";
import {
  primarySegmentIdx,
  transcriptMultiSelectionField,
  transcriptMultiSelectionEqual,
} from "./selectionField";
import { segmentMetaField, setSegmentMetaEffect } from "./segmentMetaField";
import { frozenInSelectionDeco, frozenSelectedDeco } from "./frozenLineDecorations";

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
  const meta = state.field(segmentMetaField, false) ?? [];
  const lineCount = state.doc.lines;

  // O(k): only selected indices + primary, sorted for RangeSetBuilder.
  const indices = new Set<number>(selectedSet);
  if (primary >= 0) indices.add(primary);
  const sorted = [...indices].sort((a, b) => a - b);

  for (const i of sorted) {
    if (i < 0 || i >= lineCount) continue;
    const line = state.doc.line(i + 1);
    // Frozen rows never take the saffron primary / in-selection wash.
    if (meta[i]?.frozen) {
      if (i === primary) builder.add(line.from, line.from, frozenSelectedDeco);
      else if (selectedSet.has(i)) builder.add(line.from, line.from, frozenInSelectionDeco);
      continue;
    }
    if (i === primary) builder.add(line.from, line.from, primaryDeco);
    else builder.add(line.from, line.from, inSelectionDeco);
  }
  return builder.finish();
}

function metaHasSetEffect(tr: { effects: readonly unknown[] }): boolean {
  for (const e of tr.effects) {
    if ((e as { is?: (t: typeof setSegmentMetaEffect) => boolean }).is?.(setSegmentMetaEffect)) {
      return true;
    }
  }
  return false;
}

/**
 * Line decorations for primary / in-selection rows.
 * Driven only by CM6 selection + multi-select field — no React selectedIdx.
 *
 * Rebuild on doc changes: zero-length line decorations at `line.from` are not
 * reliable under `RangeSet.map` (typing at line start can drop the class while
 * gutters still show primary from live `primarySegmentIdx`).
 *
 * Also rebuild when segment meta flips so a newly frozen primary sheds saffron wash.
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
    if (selectionChanged || multiChanged || tr.docChanged || metaHasSetEffect(tr)) {
      return buildSelectionDecorations(tr.state);
    }
    return _value;
  },
  provide: (f) => EditorView.decorations.from(f),
});
