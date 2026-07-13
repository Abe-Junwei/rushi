import { RangeSetBuilder, StateEffect, StateField, type Extension } from "@codemirror/state";
import { Decoration, EditorView } from "@codemirror/view";
import type { DecorationSet } from "@codemirror/view";
import {
  primarySegmentIdx,
  transcriptMultiSelectionField,
  transcriptMultiSelectionEqual,
} from "./selectionField";
import {
  setTranscriptPlaybackFocusEffect,
  transcriptPlaybackFocusField,
} from "./playbackFocusField";

/**
 * Tracks which segment line the pointer is over.
 * Drives a light row wash (skipped on selected / playback-focus rows) and
 * force-reveals the stage play control.
 */
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
  const playbackIdx = state.field(transcriptPlaybackFocusField);
  // No extra hover wash on selected or playback-focus rows (keep their own fill).
  if (
    hoverIdx === primary ||
    multi.selectedSet.has(hoverIdx) ||
    (playbackIdx != null && hoverIdx === playbackIdx)
  ) {
    return Decoration.none;
  }
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
      tr.startState.field(transcriptHoverSegmentField) !==
      tr.state.field(transcriptHoverSegmentField);
    const selectionChanged =
      primarySegmentIdx(tr.startState) !== primarySegmentIdx(tr.state);
    const multiChanged = !transcriptMultiSelectionEqual(
      tr.startState.field(transcriptMultiSelectionField),
      tr.state.field(transcriptMultiSelectionField),
    );
    const playbackChanged =
      tr.effects.some((e) => e.is(setTranscriptPlaybackFocusEffect)) ||
      tr.startState.field(transcriptPlaybackFocusField) !==
        tr.state.field(transcriptPlaybackFocusField);
    if (
      selectionChanged ||
      hoverChanged ||
      hoverFieldChanged ||
      multiChanged ||
      playbackChanged ||
      tr.docChanged
    ) {
      return buildHoverDecorations(tr.state);
    }
    return value;
  },
  provide: (f) => EditorView.decorations.from(f),
});

export function createTranscriptHoverPointerHandlers(): Extension {
  return EditorView.domEventHandlers({
    mousemove(event, view) {
      // precise=false: map gutter / padding coords to nearest line so hover-play
      // stays when the pointer moves from text onto the stage play control.
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY }, false);
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
  createTranscriptHoverPointerHandlers(),
];
