import { StateEffect, StateField } from "@codemirror/state";
import type { EditorState } from "@codemirror/state";

export type TranscriptMultiSelection = {
  /** 0-based segment/line indices in the multi-select set (includes primary). */
  selectedSet: ReadonlySet<number>;
  /** Shift-range anchor (0-based). */
  rangeAnchor: number;
  /**
   * Explicit primary segment idx (0-based), captured when a selection is
   * committed and then HELD independent of the live text caret. -1 = derive from
   * caret (pre-selection / fallback).
   *
   * The highlighted "primary" segment is a segment-level concept, not a text
   * caret. Deriving it live from `selection.main.head` made it hostage to
   * uncontrolled caret drift: right-clicking inside the contenteditable moves the
   * DOM caret, and CM's `selectionchange` readback would then flip primary onto
   * the neighbouring segment ("点右键高亮跳下一条"). Storing it explicitly keeps
   * caret-only changes (right-click, mid-segment text clicks) from moving the
   * highlight; all legitimate primary changes flow through
   * {@link setTranscriptMultiSelectionEffect}.
   *
   * Research: docs/execution/specs/transcript-primary-caret-decouple-research.md
   */
  primaryIdx: number;
};

/**
 * Effect payload keeps `primaryIdx` optional so existing call sites
 * (`{ selectedSet, rangeAnchor }`) stay valid; the field captures the caret line
 * at commit time when omitted (all commit transactions set the caret to the
 * primary line in the same tx, so this equals the intended primary).
 */
export type TranscriptMultiSelectionInput = {
  selectedSet: ReadonlySet<number>;
  rangeAnchor: number;
  primaryIdx?: number;
};

export const setTranscriptMultiSelectionEffect =
  StateEffect.define<TranscriptMultiSelectionInput>();

const EMPTY: TranscriptMultiSelection = {
  selectedSet: new Set(),
  rangeAnchor: 0,
  primaryIdx: -1,
};

/** Caret-derived segment idx (legacy behaviour), used only to capture/fallback. */
function caretSegmentIdx(state: EditorState): number {
  if (state.doc.lines <= 0) return -1;
  return state.doc.lineAt(state.selection.main.head).number - 1;
}

export const transcriptMultiSelectionField = StateField.define<TranscriptMultiSelection>({
  create(state) {
    return { ...EMPTY, primaryIdx: caretSegmentIdx(state) };
  },
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(setTranscriptMultiSelectionEffect)) {
        const v = e.value;
        // Capture primary at commit time (explicit, or the tx's caret line —
        // all commit transactions set the caret to the primary line in the same
        // tx, so the caret fallback equals the intended primary).
        const primaryIdx = v.primaryIdx ?? caretSegmentIdx(tr.state);
        return { selectedSet: v.selectedSet, rangeAnchor: v.rangeAnchor, primaryIdx };
      }
    }
    // A caret-only change (no effect, no doc edit) must NOT move primary — this
    // is what keeps right-click / mid-segment caret drift off the highlight.
    if (!tr.docChanged) return value;
    const lineCount = tr.state.doc.lines;
    if (lineCount <= 0) return EMPTY;
    const next = new Set<number>();
    for (const idx of value.selectedSet) {
      if (idx >= 0 && idx < lineCount) next.add(idx);
    }
    const rangeAnchor = Math.max(0, Math.min(value.rangeAnchor, lineCount - 1));
    let primaryIdx = value.primaryIdx;
    if (primaryIdx < 0 || primaryIdx >= lineCount) primaryIdx = caretSegmentIdx(tr.state);
    if (next.size === 0) {
      const primary = primaryIdx >= 0 ? primaryIdx : caretSegmentIdx(tr.state);
      if (primary < 0) return EMPTY;
      return { selectedSet: new Set([primary]), rangeAnchor: primary, primaryIdx: primary };
    }
    return { selectedSet: next, rangeAnchor, primaryIdx };
  },
});

/**
 * Primary segment index (0-based). -1 if empty doc.
 * Prefers the explicitly-stored primary (decoupled from caret drift), falling
 * back to the caret line before any selection is committed.
 */
export function primarySegmentIdx(state: EditorState): number {
  if (state.doc.lines <= 0) return -1;
  const stored = state.field(transcriptMultiSelectionField, false)?.primaryIdx ?? -1;
  if (stored >= 0 && stored < state.doc.lines) return stored;
  return caretSegmentIdx(state);
}

export function getTranscriptMultiSelection(state: EditorState): TranscriptMultiSelection {
  return state.field(transcriptMultiSelectionField);
}

export function transcriptMultiSelectionEqual(
  a: TranscriptMultiSelection,
  b: TranscriptMultiSelection,
): boolean {
  if (a === b) return true;
  if (
    a.rangeAnchor !== b.rangeAnchor ||
    a.primaryIdx !== b.primaryIdx ||
    a.selectedSet.size !== b.selectedSet.size
  )
    return false;
  for (const idx of a.selectedSet) {
    if (!b.selectedSet.has(idx)) return false;
  }
  return true;
}
