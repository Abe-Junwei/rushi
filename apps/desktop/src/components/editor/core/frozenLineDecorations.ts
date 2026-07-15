import { RangeSetBuilder, StateField } from "@codemirror/state";
import type { EditorState } from "@codemirror/state";
import { Decoration, EditorView } from "@codemirror/view";
import type { DecorationSet } from "@codemirror/view";
import { segmentMetaField, setSegmentMetaEffect } from "./segmentMetaField";

const frozenDeco = Decoration.line({
  attributes: { class: "cm-transcript-frozen-line" },
});

/** Soft selected cue for frozen primary — never saffron wash. */
const frozenSelectedDeco = Decoration.line({
  attributes: { class: "cm-transcript-frozen-selected" },
});

/** Weaker callout for frozen non-primary rows in multi-selection (aligns with waveform). */
const frozenInSelectionDeco = Decoration.line({
  attributes: { class: "cm-transcript-frozen-in-selection" },
});

function collectFrozenIndices(state: EditorState): number[] {
  const meta = state.field(segmentMetaField, false) ?? [];
  const lineCount = state.doc.lines;
  const n = Math.min(meta.length, lineCount);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    if (meta[i]?.frozen) out.push(i);
  }
  return out;
}

function buildFrozenDecorationsFromIndices(
  state: EditorState,
  frozenIndices: readonly number[],
): DecorationSet {
  if (frozenIndices.length === 0) return Decoration.none;
  const builder = new RangeSetBuilder<typeof frozenDeco>();
  const lineCount = state.doc.lines;
  for (const i of frozenIndices) {
    if (i < 0 || i >= lineCount) continue;
    const line = state.doc.line(i + 1);
    builder.add(line.from, line.from, frozenDeco);
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

type FrozenLineDecorationState = {
  frozenIndices: readonly number[];
  decorations: DecorationSet;
};

/** Diagonal-hatch line class for frozen segments (CSS in transcript theme). */
export const transcriptFrozenLineDecorations = StateField.define<FrozenLineDecorationState>({
  create(state) {
    const frozenIndices = collectFrozenIndices(state);
    return {
      frozenIndices,
      decorations: buildFrozenDecorationsFromIndices(state, frozenIndices),
    };
  },
  update(value, tr) {
    if (metaHasSetEffect(tr) || (tr.docChanged && tr.state.doc.lines !== tr.startState.doc.lines)) {
      const frozenIndices = collectFrozenIndices(tr.state);
      return {
        frozenIndices,
        decorations: buildFrozenDecorationsFromIndices(tr.state, frozenIndices),
      };
    }
    if (tr.docChanged) {
      // Same line count: O(k) rebuild from cached indices (typing must not drop hatch).
      return {
        frozenIndices: value.frozenIndices,
        decorations: buildFrozenDecorationsFromIndices(tr.state, value.frozenIndices),
      };
    }
    return value;
  },
  provide: (f) => EditorView.decorations.from(f, (v) => v.decorations),
});

/**
 * Soft idle hatch over content only (not gutters) so stage play/loop stay clear
 * and body text stays readable. Uses muted secondary at low alpha + wide gaps.
 */
const FROZEN_HATCH =
  "repeating-linear-gradient(-45deg, transparent, transparent 5px, color-mix(in srgb, var(--accent-action) 22%, transparent) 5px, color-mix(in srgb, var(--accent-action) 22%, transparent) 6px)";

/**
 * Frozen visual language (Notion Zen, neutral):
 * - No saffron selection / hover / playback wash
 * - Soft content-only hatch
 * - Full-contrast body text; transparent caret; default cursor
 * - Selected frozen: light callout fill + muted left hairline (not accent wash)
 *
 * Uses EditorView.theme (not baseTheme) so overrides beat appearance theme washes.
 */
export const transcriptFrozenLineTheme = EditorView.theme({
  ".cm-transcript-frozen-line": {
    position: "relative",
    isolation: "isolate",
    caretColor: "transparent",
    cursor: "default",
    // Keep body text at full ink contrast — hatch is sparse enough not to fight it.
    color: "var(--notion-text)",
  },
  // Kill non-frozen highlight washes whenever the row is frozen.
  ".cm-transcript-frozen-line.cm-transcript-primary-line, .cm-transcript-frozen-line.cm-transcript-in-selection-line, .cm-transcript-frozen-line.cm-transcript-hover-line, .cm-transcript-frozen-line.cm-transcript-playback-focus, .cm-transcript-frozen-line.cm-transcript-primary-line.cm-transcript-playback-focus":
    {
      backgroundColor: "transparent",
      boxShadow: "none",
    },
  // Soft selected cue — same gutter extents as primary selection wash.
  ".cm-transcript-frozen-line.cm-transcript-frozen-selected": {
    backgroundColor: "color-mix(in srgb, var(--notion-callout-bg) 70%, transparent)",
    boxShadow: [
      "calc(-1 * var(--cm-meta-gutter-width, 8.25rem)) 0 0 0 color-mix(in srgb, var(--notion-callout-bg) 70%, transparent)",
      "var(--cm-stage-gutter-width, 12rem) 0 0 0 color-mix(in srgb, var(--notion-callout-bg) 70%, transparent)",
    ].join(", "),
  },
  // Weaker multi-select cue for frozen non-primary (matches waveform overlay).
  ".cm-transcript-frozen-line.cm-transcript-frozen-in-selection": {
    backgroundColor: "color-mix(in srgb, var(--notion-callout-bg) 40%, transparent)",
    boxShadow: [
      "calc(-1 * var(--cm-meta-gutter-width, 8.25rem)) 0 0 0 color-mix(in srgb, var(--notion-callout-bg) 40%, transparent)",
      "var(--cm-stage-gutter-width, 12rem) 0 0 0 color-mix(in srgb, var(--notion-callout-bg) 40%, transparent)",
    ].join(", "),
  },
  // Hatch spans meta + text + stage gutters (same extents as selection wash).
  ".cm-transcript-frozen-line::after": {
    content: '""',
    pointerEvents: "none",
    position: "absolute",
    top: "0",
    bottom: "0",
    left: "calc(-1 * var(--cm-meta-gutter-width, 8.25rem))",
    right: "calc(-1 * var(--cm-stage-gutter-width, 12rem))",
    zIndex: "-1",
    backgroundImage: FROZEN_HATCH,
  },
});

export { frozenSelectedDeco, frozenInSelectionDeco };
