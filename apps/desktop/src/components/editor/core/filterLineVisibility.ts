import { RangeSetBuilder, StateEffect, StateField } from "@codemirror/state";
import type { EditorState } from "@codemirror/state";
import { Decoration, EditorView } from "@codemirror/view";
import type { DecorationSet } from "@codemirror/view";

/**
 * null = show all lines (filter inactive).
 * Set = segment indices that remain visible when filter is active.
 */
export type TranscriptFilterVisibleSet = ReadonlySet<number> | null;

export const setTranscriptFilterVisibleEffect =
  StateEffect.define<TranscriptFilterVisibleSet>();

const hiddenLineDeco = Decoration.line({
  attributes: { class: "cm-transcript-filter-hidden" },
});

function buildHiddenLineDecorations(
  state: EditorState,
  visible: TranscriptFilterVisibleSet,
): DecorationSet {
  if (visible == null) return Decoration.none;
  const builder = new RangeSetBuilder<typeof hiddenLineDeco>();
  const lineCount = state.doc.lines;
  for (let i = 0; i < lineCount; i++) {
    if (visible.has(i)) continue;
    const line = state.doc.line(i + 1);
    builder.add(line.from, line.from, hiddenLineDeco);
  }
  return builder.finish();
}

type FilterVisibilityState = {
  visible: TranscriptFilterVisibleSet;
  decorations: DecorationSet;
};

/**
 * Hide non-matching segment lines while keeping one-line-per-segment idx mapping.
 */
export const transcriptFilterVisibilityField = StateField.define<FilterVisibilityState>({
  create() {
    return { visible: null, decorations: Decoration.none };
  },
  update(value, tr) {
    let visible = value.visible;
    for (const e of tr.effects) {
      if (e.is(setTranscriptFilterVisibleEffect)) visible = e.value;
    }
    if (visible !== value.visible || tr.docChanged) {
      return {
        visible,
        decorations: buildHiddenLineDecorations(tr.state, visible),
      };
    }
    return value;
  },
  provide: (f) => EditorView.decorations.from(f, (v) => v.decorations),
});

export const transcriptFilterVisibilityTheme = EditorView.theme({
  ".cm-line.cm-transcript-filter-hidden": {
    display: "none",
  },
});

export function getTranscriptFilterVisibleSet(
  state: EditorState,
): TranscriptFilterVisibleSet {
  return state.field(transcriptFilterVisibilityField).visible;
}

/** Next visible segment idx walking `delta`, or null if none. */
export function resolveNextVisibleSegmentIdx(
  state: EditorState,
  fromIdx: number,
  delta: -1 | 1,
): number | null {
  const lineCount = state.doc.lines;
  if (lineCount <= 0) return null;
  const visible = getTranscriptFilterVisibleSet(state);
  let i = fromIdx + delta;
  while (i >= 0 && i < lineCount) {
    if (visible == null || visible.has(i)) return i;
    i += delta;
  }
  return null;
}
