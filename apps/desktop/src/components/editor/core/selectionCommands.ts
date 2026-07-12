import { EditorSelection } from "@codemirror/state";
import type { EditorState, TransactionSpec } from "@codemirror/state";
import {
  normalizeSegmentIndexRange,
  rangeIndices,
  resolveSegmentSelectionAnchor,
  toggleSegmentIndex,
} from "../../../utils/segmentSelection";
import {
  primarySegmentIdx,
  setTranscriptMultiSelectionEffect,
  transcriptMultiSelectionField,
} from "./selectionField";
import { resolveNextVisibleSegmentIdx } from "./filterLineVisibility";

export type SelectSegmentOptions = {
  shiftKey?: boolean;
  toggle?: boolean;
  scrollIntoView?: boolean;
  /** Doc position for caret when selecting a single primary (clamped to the segment line). */
  caretPos?: number;
};

/**
 * Whether content-area mousedown should consume the event (block CM drag-select).
 * Same-segment plain click stays with CM so users can place caret / drag-select text.
 */
export function shouldConsumeTranscriptContentMousedown(input: {
  clickedIdx: number;
  primaryIdx: number;
  shiftKey: boolean;
  toggle: boolean;
}): boolean {
  if (input.shiftKey || input.toggle) return true;
  return input.clickedIdx !== input.primaryIdx;
}

function cursorAtSegmentLine(
  state: EditorState,
  segmentIdx: number,
  caretPos?: number,
): EditorSelection {
  const line = state.doc.line(segmentIdx + 1);
  if (caretPos != null && caretPos >= line.from && caretPos <= line.to) {
    return EditorSelection.single(caretPos);
  }
  return EditorSelection.single(line.from);
}

/**
 * Build a transaction that updates CM6 selection + multi-select field.
 * This is the only write path for selection under transcriptEditorCore.
 */
export function selectSegmentTransaction(
  state: EditorState,
  idx: number,
  opts: SelectSegmentOptions = {},
): TransactionSpec | null {
  const segmentCount = state.doc.lines;
  if (segmentCount <= 0 || idx < 0 || idx >= segmentCount) return null;

  const multi = state.field(transcriptMultiSelectionField);
  const primary = primarySegmentIdx(state);
  const scrollIntoView = opts.scrollIntoView !== false;

  if (opts.toggle) {
    const toggled = toggleSegmentIndex(multi.selectedSet, primary, idx);
    if (!toggled) {
      return {
        selection: cursorAtSegmentLine(state, 0),
        effects: setTranscriptMultiSelectionEffect.of({
          selectedSet: new Set([0]),
          rangeAnchor: 0,
        }),
        scrollIntoView,
      };
    }
    return {
      selection: cursorAtSegmentLine(state, toggled.primaryIdx),
      effects: setTranscriptMultiSelectionEffect.of({
        selectedSet: toggled.indices,
        rangeAnchor:
          toggled.indices.size === 1 ? toggled.primaryIdx : multi.rangeAnchor,
      }),
      scrollIntoView,
    };
  }

  if (opts.shiftKey) {
    const anchor = resolveSegmentSelectionAnchor(multi.rangeAnchor, primary, idx);
    const normalized = normalizeSegmentIndexRange(anchor, idx, segmentCount);
    if (!normalized) {
      return {
        selection: cursorAtSegmentLine(state, idx),
        effects: setTranscriptMultiSelectionEffect.of({
          selectedSet: new Set([idx]),
          rangeAnchor: idx,
        }),
        scrollIntoView,
      };
    }
    return {
      selection: cursorAtSegmentLine(state, idx),
      effects: setTranscriptMultiSelectionEffect.of({
        selectedSet: rangeIndices(normalized.lo, normalized.hi),
        rangeAnchor: anchor,
      }),
      scrollIntoView,
    };
  }

  return {
    selection: cursorAtSegmentLine(state, idx, opts.caretPos),
    effects: setTranscriptMultiSelectionEffect.of({
      selectedSet: new Set([idx]),
      rangeAnchor: idx,
    }),
    scrollIntoView,
  };
}

export function movePrimarySegmentTransaction(
  state: EditorState,
  delta: -1 | 1,
  opts: { shiftKey?: boolean; scrollIntoView?: boolean } = {},
): TransactionSpec | null {
  const segmentCount = state.doc.lines;
  if (segmentCount <= 0) return null;
  const primary = primarySegmentIdx(state);
  const next = resolveNextVisibleSegmentIdx(state, primary, delta);
  if (next == null) return null;
  if (next === primary && !opts.shiftKey) return null;
  return selectSegmentTransaction(state, next, {
    shiftKey: opts.shiftKey,
    scrollIntoView: opts.scrollIntoView,
  });
}

export function selectSegmentCommand(
  view: { state: EditorState; dispatch: (tr: TransactionSpec) => void },
  idx: number,
  opts?: SelectSegmentOptions,
): boolean {
  const tr = selectSegmentTransaction(view.state, idx, opts);
  if (!tr) return false;
  view.dispatch(tr);
  return true;
}

/** Set an arbitrary multi-select set + primary (lasso / structure restore). */
export function selectSegmentIndicesTransaction(
  state: EditorState,
  indices: Iterable<number>,
  primaryIdx: number,
  opts: { scrollIntoView?: boolean } = {},
): TransactionSpec | null {
  const segmentCount = state.doc.lines;
  if (segmentCount <= 0) return null;
  const next = new Set<number>();
  for (const raw of indices) {
    if (raw >= 0 && raw < segmentCount) next.add(raw);
  }
  if (next.size === 0) return null;
  const primary = next.has(primaryIdx) ? primaryIdx : Math.min(...next);
  const scrollIntoView = opts.scrollIntoView !== false;
  return {
    selection: cursorAtSegmentLine(state, primary),
    effects: setTranscriptMultiSelectionEffect.of({
      selectedSet: next,
      rangeAnchor: Math.min(...next),
    }),
    scrollIntoView,
  };
}

export function selectSegmentIndicesCommand(
  view: { state: EditorState; dispatch: (tr: TransactionSpec) => void },
  indices: Iterable<number>,
  primaryIdx: number,
  opts?: { scrollIntoView?: boolean },
): boolean {
  const tr = selectSegmentIndicesTransaction(view.state, indices, primaryIdx, opts);
  if (!tr) return false;
  view.dispatch(tr);
  return true;
}

export function selectSegmentRangeCommand(
  view: { state: EditorState; dispatch: (tr: TransactionSpec) => void },
  lo: number,
  hi: number,
  opts?: { scrollIntoView?: boolean },
): boolean {
  const normalized = normalizeSegmentIndexRange(lo, hi, view.state.doc.lines);
  if (!normalized) return false;
  return selectSegmentIndicesCommand(
    view,
    rangeIndices(normalized.lo, normalized.hi),
    normalized.hi,
    opts,
  );
}

export function movePrimarySegmentCommand(
  view: { state: EditorState; dispatch: (tr: TransactionSpec) => void },
  delta: -1 | 1,
  opts?: { shiftKey?: boolean },
): boolean {
  const tr = movePrimarySegmentTransaction(view.state, delta, opts);
  if (!tr) return false;
  view.dispatch(tr);
  return true;
}
