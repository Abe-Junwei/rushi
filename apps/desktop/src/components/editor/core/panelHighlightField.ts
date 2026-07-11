import { RangeSetBuilder, StateEffect, StateField } from "@codemirror/state";
import { Decoration, EditorView } from "@codemirror/view";
import type { DecorationSet } from "@codemirror/view";
import { segmentCharRangeToDocRange } from "./segmentCharRangeToDoc";

export type TranscriptPanelHighlight = {
  segmentIdx: number;
  charStart: number;
  charEnd: number;
} | null;

export const setTranscriptPanelHighlightEffect =
  StateEffect.define<TranscriptPanelHighlight>();

const panelHighlightMark = Decoration.mark({
  class: "cm-transcript-panel-highlight",
});

function buildPanelHighlightDecorations(
  state: import("@codemirror/state").EditorState,
  highlight: TranscriptPanelHighlight,
): DecorationSet {
  if (!highlight) return Decoration.none;
  const range = segmentCharRangeToDocRange(
    state,
    highlight.segmentIdx,
    highlight.charStart,
    highlight.charEnd,
  );
  if (!range || range.from >= range.to) return Decoration.none;
  const builder = new RangeSetBuilder<typeof panelHighlightMark>();
  builder.add(range.from, range.to, panelHighlightMark);
  return builder.finish();
}

type PanelHighlightState = {
  highlight: TranscriptPanelHighlight;
  decorations: DecorationSet;
};

/**
 * Find/replace + correction-rules active match highlight (mark decoration).
 * Driven by {@link setTranscriptPanelHighlightEffect} from React props.
 */
export const transcriptPanelHighlightField = StateField.define<PanelHighlightState>({
  create() {
    return { highlight: null, decorations: Decoration.none };
  },
  update(value, tr) {
    let highlight = value.highlight;
    for (const e of tr.effects) {
      if (e.is(setTranscriptPanelHighlightEffect)) highlight = e.value;
    }
    if (highlight !== value.highlight) {
      return {
        highlight,
        decorations: buildPanelHighlightDecorations(tr.state, highlight),
      };
    }
    if (tr.docChanged) {
      return { highlight, decorations: value.decorations.map(tr.changes) };
    }
    return value;
  },
  provide: (f) => EditorView.decorations.from(f, (v) => v.decorations),
});

export const transcriptPanelHighlightTheme = EditorView.theme({
  ".cm-transcript-panel-highlight": {
    backgroundColor: "color-mix(in srgb, var(--accent-action) 34%, transparent)",
    borderRadius: "2px",
  },
});
