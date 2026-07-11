import { RangeSetBuilder, StateEffect, StateField, type Extension } from "@codemirror/state";
import { Decoration, EditorView } from "@codemirror/view";
import type { DecorationSet } from "@codemirror/view";
import {
  primarySegmentIdx,
  transcriptMultiSelectionField,
  transcriptMultiSelectionEqual,
} from "./selectionField";

export const setTranscriptHoverSegmentEffect = StateEffect.define<number | null>();

export const transcriptHoverSegmentField = StateField.define<number | null>({
  create: () => null,
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(setTranscriptHoverSegmentEffect)) return e.value;
    }
    if (!tr.docChanged) return value;
    if (value == null) return null;
    const lineCount = tr.state.doc.lines;
    if (lineCount <= 0) return null;
    return Math.max(0, Math.min(value, lineCount - 1));
  },
});

const hoverDeco = Decoration.line({
  attributes: { class: "cm-transcript-hover-line" },
});

function buildHoverDecorations(state: import("@codemirror/state").EditorState): DecorationSet {
  const hoverIdx = state.field(transcriptHoverSegmentField);
  if (hoverIdx == null || hoverIdx < 0) return Decoration.none;
  const primary = primarySegmentIdx(state);
  const multi = state.field(transcriptMultiSelectionField);
  if (hoverIdx === primary || multi.selectedSet.has(hoverIdx)) return Decoration.none;
  if (hoverIdx >= state.doc.lines) return Decoration.none;
  const line = state.doc.line(hoverIdx + 1);
  const builder = new RangeSetBuilder<typeof hoverDeco>();
  builder.add(line.from, line.from, hoverDeco);
  return builder.finish();
}

export const transcriptHoverDecorations = StateField.define<DecorationSet>({
  create(state) {
    return buildHoverDecorations(state);
  },
  update(value, tr) {
    const hoverChanged = tr.effects.some((e) => e.is(setTranscriptHoverSegmentEffect));
    const hoverFieldChanged =
      tr.startState.field(transcriptHoverSegmentField) !== tr.state.field(transcriptHoverSegmentField);
    const selectionChanged =
      primarySegmentIdx(tr.startState) !== primarySegmentIdx(tr.state);
    const multiChanged =
      !transcriptMultiSelectionEqual(
        tr.startState.field(transcriptMultiSelectionField),
        tr.state.field(transcriptMultiSelectionField),
      );
    if (selectionChanged || hoverChanged || hoverFieldChanged || multiChanged) {
      return buildHoverDecorations(tr.state);
    }
    return tr.docChanged ? value.map(tr.changes) : value;
  },
  provide: (f) => EditorView.decorations.from(f),
});

export const transcriptHoverTheme = EditorView.theme({
  // Match legacy `hover:bg-notion-sidebar/35` on `.seg-row-shell`.
  ".cm-transcript-hover-line": {
    backgroundColor: "color-mix(in srgb, var(--notion-sidebar) 35%, transparent)",
  },
  ".cm-transcript-meta-marker--hover": {
    backgroundColor: "color-mix(in srgb, var(--notion-sidebar) 35%, transparent)",
  },
  ".cm-transcript-stage-cell--hover": {
    backgroundColor: "color-mix(in srgb, var(--notion-sidebar) 35%, transparent)",
  },
});

export function createTranscriptHoverPointerHandlers(): Extension {
  return EditorView.domEventHandlers({
    mousemove(event, view) {
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
      const next = pos == null ? null : view.state.doc.lineAt(pos).number - 1;
      if (next === view.state.field(transcriptHoverSegmentField)) return false;
      view.dispatch({ effects: setTranscriptHoverSegmentEffect.of(next) });
      return false;
    },
    mouseleave(_event, view) {
      if (view.state.field(transcriptHoverSegmentField) == null) return false;
      view.dispatch({ effects: setTranscriptHoverSegmentEffect.of(null) });
      return false;
    },
  });
}

export const transcriptHoverExtensions: Extension[] = [
  transcriptHoverSegmentField,
  transcriptHoverDecorations,
  transcriptHoverTheme,
  createTranscriptHoverPointerHandlers(),
];
