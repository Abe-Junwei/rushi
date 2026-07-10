import { StateEffect, StateField } from "@codemirror/state";
import type { EditorState } from "@codemirror/state";

export type TranscriptMultiSelection = {
  /** 0-based segment/line indices in the multi-select set (includes primary). */
  selectedSet: ReadonlySet<number>;
  /** Shift-range anchor (0-based). */
  rangeAnchor: number;
};

export const setTranscriptMultiSelectionEffect =
  StateEffect.define<TranscriptMultiSelection>();

const EMPTY: TranscriptMultiSelection = {
  selectedSet: new Set(),
  rangeAnchor: 0,
};

export const transcriptMultiSelectionField = StateField.define<TranscriptMultiSelection>({
  create() {
    return EMPTY;
  },
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(setTranscriptMultiSelectionEffect)) return e.value;
    }
    if (!tr.docChanged) return value;
    const lineCount = tr.state.doc.lines;
    if (lineCount <= 0) return EMPTY;
    const next = new Set<number>();
    for (const idx of value.selectedSet) {
      if (idx >= 0 && idx < lineCount) next.add(idx);
    }
    const rangeAnchor = Math.max(0, Math.min(value.rangeAnchor, lineCount - 1));
    if (next.size === 0) {
      const primary = primarySegmentIdx(tr.state);
      if (primary < 0) return EMPTY;
      return { selectedSet: new Set([primary]), rangeAnchor: primary };
    }
    return { selectedSet: next, rangeAnchor };
  },
});

/** Primary segment index from CM6 main selection (0-based). -1 if empty doc. */
export function primarySegmentIdx(state: EditorState): number {
  if (state.doc.lines <= 0) return -1;
  return state.doc.lineAt(state.selection.main.head).number - 1;
}

export function getTranscriptMultiSelection(state: EditorState): TranscriptMultiSelection {
  return state.field(transcriptMultiSelectionField);
}
