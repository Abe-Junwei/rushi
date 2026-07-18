import { RangeSetBuilder, StateEffect, StateField, type Extension } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin } from "@codemirror/view";
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
import { resolveTranscriptSegmentIdxAtPointer } from "./resolveTranscriptSegmentIdxAtPointer";

/**
 * Tracks which segment line the pointer is over.
 * Drives a light row wash (skipped on selected / playback-focus rows) and
 * force-reveals the play control (including when the pointer is over the left
 * meta gutter / seam — not only the text content box).
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

/**
 * Include text, play-seam widget, and left meta gutter (timestamp column).
 *
 * Must NOT use `EditorView.domEventHandlers` for this: CM6 attaches those to
 * `contentDOM` only, so moving into the left meta gutter fires `mouseleave` and
 * clears hover — exactly when the play control (over the meta↔text seam) needs
 * to stay revealed.
 */
function resolveHoverSegmentIdx(view: EditorView, event: MouseEvent): number | null {
  const prev = view.state.field(transcriptHoverSegmentField);
  try {
    const next = resolveTranscriptSegmentIdxAtPointer(
      view,
      event.clientX,
      event.clientY,
      event.target,
    );
    if (next != null) return next;
    const el = event.target instanceof Element ? event.target : null;
    if (prev != null && el != null && view.dom.contains(el)) return prev;
    return null;
  } catch {
    return prev;
  }
}

function setHoverIdx(view: EditorView, next: number | null) {
  if (next === view.state.field(transcriptHoverSegmentField)) return;
  view.dispatch({ effects: setTranscriptHoverSegmentEffect.of(next) });
}

/**
 * Listen on `view.dom` (gutters + content), not `contentDOM`.
 */
export const transcriptHoverPointerPlugin = ViewPlugin.fromClass(
  class {
    private readonly onMove: (event: MouseEvent) => void;
    private readonly onLeave: (event: MouseEvent) => void;

    constructor(private readonly view: EditorView) {
      this.onMove = (event: MouseEvent) => {
        setHoverIdx(this.view, resolveHoverSegmentIdx(this.view, event));
      };
      this.onLeave = (event: MouseEvent) => {
        // Only clear when leaving the whole editor chrome (not content→gutter).
        const related = event.relatedTarget;
        if (related instanceof Node && this.view.dom.contains(related)) return;
        setHoverIdx(this.view, null);
      };
      this.view.dom.addEventListener("mousemove", this.onMove);
      this.view.dom.addEventListener("mouseleave", this.onLeave);
    }

    destroy() {
      this.view.dom.removeEventListener("mousemove", this.onMove);
      this.view.dom.removeEventListener("mouseleave", this.onLeave);
    }
  },
);

export const transcriptHoverExtensions: Extension[] = [
  transcriptHoverSegmentField,
  transcriptHoverDecorations,
  transcriptHoverPointerPlugin,
];
