import { StateEffect, StateField, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

/**
 * Tracks which segment line the pointer is over.
 * Used only to force-reveal the stage play control — no row wash
 * (wash competed with selection / playback fills and caused switch flicker).
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
  createTranscriptHoverPointerHandlers(),
];
