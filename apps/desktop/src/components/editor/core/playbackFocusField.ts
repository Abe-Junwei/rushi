import { RangeSetBuilder, StateEffect, StateField, type Extension } from "@codemirror/state";
import { Decoration, EditorView } from "@codemirror/view";
import type { DecorationSet } from "@codemirror/view";

export const setTranscriptPlaybackFocusEffect = StateEffect.define<number | null>();

export const transcriptPlaybackFocusField = StateField.define<number | null>({
  create: () => null,
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(setTranscriptPlaybackFocusEffect)) return e.value;
    }
    if (!tr.docChanged) return value;
    if (value == null) return null;
    const lineCount = tr.state.doc.lines;
    if (lineCount <= 0) return null;
    return Math.max(0, Math.min(value, lineCount - 1));
  },
});

const playbackFocusDeco = Decoration.line({
  attributes: { class: "cm-transcript-playback-focus" },
});

function buildPlaybackFocusDecorations(
  state: import("@codemirror/state").EditorState,
): DecorationSet {
  const focusIdx = state.field(transcriptPlaybackFocusField);
  if (focusIdx == null || focusIdx < 0) return Decoration.none;
  if (focusIdx >= state.doc.lines) return Decoration.none;
  const line = state.doc.line(focusIdx + 1);
  const builder = new RangeSetBuilder<typeof playbackFocusDeco>();
  builder.add(line.from, line.from, playbackFocusDeco);
  return builder.finish();
}

export const transcriptPlaybackFocusDecorations = StateField.define<DecorationSet>({
  create(state) {
    return buildPlaybackFocusDecorations(state);
  },
  update(value, tr) {
    const focusChanged = tr.effects.some((e) => e.is(setTranscriptPlaybackFocusEffect));
    const fieldChanged =
      tr.startState.field(transcriptPlaybackFocusField) !==
      tr.state.field(transcriptPlaybackFocusField);
    if (focusChanged || fieldChanged || tr.docChanged) {
      return buildPlaybackFocusDecorations(tr.state);
    }
    return value;
  },
  provide: (f) => EditorView.decorations.from(f),
});

/** Playback Focus fill: cool gray wash; selected∩playing → deeper saffron. */
export const transcriptPlaybackFocusTheme = EditorView.theme({
  ".cm-transcript-playback-focus": {
    backgroundColor: "var(--transcript-playback-focus-fill)",
  },
  ".cm-transcript-primary-line.cm-transcript-playback-focus": {
    backgroundColor: "var(--segment-fill-selected-playing-list)",
  },
});

export const transcriptPlaybackFocusExtensions: Extension[] = [
  transcriptPlaybackFocusField,
  transcriptPlaybackFocusDecorations,
  transcriptPlaybackFocusTheme,
];
