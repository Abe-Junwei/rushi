import { RangeSetBuilder, StateEffect, StateField } from "@codemirror/state";
import type { EditorState, Transaction } from "@codemirror/state";
import { Decoration, EditorView, WidgetType } from "@codemirror/view";
import type { DecorationSet, ViewUpdate } from "@codemirror/view";
import {
  computeFilteredSegmentIndicesFromMatchInputs,
  isDefaultSegmentListFilter,
  segmentMetaToListFilterMatchInput,
  type SegmentListFilterState,
} from "../../../services/segmentListFilter";
import { segmentMetaField, setSegmentMetaEffect } from "./segmentMetaField";

/**
 * null = show all lines (filter inactive).
 * Set = segment indices that remain visible when filter is active.
 */
export type TranscriptFilterVisibleSet = ReadonlySet<number> | null;

export type FilterHiddenRun = { fromIdx: number; toIdxInclusive: number };

export const setTranscriptFilterVisibleEffect =
  StateEffect.define<TranscriptFilterVisibleSet>();

/** Store React filter criteria so structure TX can recompute without waiting for React. */
export const setTranscriptFilterCriteriaEffect =
  StateEffect.define<SegmentListFilterState | null>();

/**
 * Collapse a filtered-out line to zero height in the CM height map.
 *
 * `display: none` on `.cm-line` looks hidden but keeps estimated (full) heights
 * until the line is measured — scrolling then shrinks `scrollHeight` and clamps
 * `scrollTop`, which feels like the viewport is forcibly pulled back.
 */
class FilterCollapseWidget extends WidgetType {
  toDOM(): HTMLElement {
    const el = document.createElement("span");
    el.className = "cm-transcript-filter-collapse";
    el.setAttribute("aria-hidden", "true");
    return el;
  }

  eq(other: WidgetType): boolean {
    return other instanceof FilterCollapseWidget;
  }

  get estimatedHeight(): number {
    return 0;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

const collapseWidget = new FilterCollapseWidget();

const collapseDeco = Decoration.replace({
  widget: collapseWidget,
  block: true,
  // Block replace defaults to inclusiveEnd — ending at the next line's `from`
  // would steal that line's line-decorations (frozen hatch, selection wash).
  inclusiveEnd: false,
});

/** Fallback for an empty last line (zero-length replace is invalid). */
const hiddenLineDeco = Decoration.line({
  attributes: { class: "cm-transcript-filter-hidden" },
});

export function computeFilterHiddenRuns(
  lineCount: number,
  visible: TranscriptFilterVisibleSet,
): FilterHiddenRun[] {
  if (visible == null || lineCount <= 0) return [];
  const runs: FilterHiddenRun[] = [];
  let runStart: number | null = null;
  for (let i = 0; i < lineCount; i++) {
    if (!visible.has(i)) {
      if (runStart == null) runStart = i;
      continue;
    }
    if (runStart != null) {
      runs.push({ fromIdx: runStart, toIdxInclusive: i - 1 });
      runStart = null;
    }
  }
  if (runStart != null) runs.push({ fromIdx: runStart, toIdxInclusive: lineCount - 1 });
  return runs;
}

function buildHiddenLineDecorationsFromRuns(
  state: EditorState,
  hiddenRuns: readonly FilterHiddenRun[],
): DecorationSet {
  if (hiddenRuns.length === 0) return Decoration.none;
  const builder = new RangeSetBuilder();
  const lineCount = state.doc.lines;

  for (const run of hiddenRuns) {
    if (run.fromIdx < 0 || run.toIdxInclusive >= lineCount) continue;
    const fromLine = state.doc.line(run.fromIdx + 1);
    const toLine = state.doc.line(run.toIdxInclusive + 1);
    // End at the next line's from (exclusive via inclusiveEnd:false) so the
    // following visible row keeps its line-decorations (frozen hatch, etc.).
    const to =
      run.toIdxInclusive + 1 < lineCount
        ? state.doc.line(run.toIdxInclusive + 2).from
        : toLine.to;
    if (to > fromLine.from) {
      builder.add(fromLine.from, to, collapseDeco);
    } else {
      builder.add(fromLine.from, fromLine.from, hiddenLineDeco);
    }
  }

  return builder.finish() as DecorationSet;
}

function buildHiddenLineDecorations(
  state: EditorState,
  visible: TranscriptFilterVisibleSet,
): { decorations: DecorationSet; hiddenRuns: FilterHiddenRun[] } {
  const hiddenRuns = computeFilterHiddenRuns(state.doc.lines, visible);
  return {
    hiddenRuns,
    decorations: buildHiddenLineDecorationsFromRuns(state, hiddenRuns),
  };
}

export function computeVisibleSetFromFilterCriteria(
  state: EditorState,
  criteria: SegmentListFilterState | null,
): TranscriptFilterVisibleSet {
  if (criteria == null || isDefaultSegmentListFilter(criteria)) return null;
  const meta = state.field(segmentMetaField, false) ?? [];
  const lineCount = state.doc.lines;
  const n = Math.min(meta.length, lineCount);
  const items = [];
  for (let i = 0; i < n; i++) {
    const m = meta[i];
    items.push(
      segmentMetaToListFilterMatchInput({
        stage: m?.stage ?? null,
        frozen: Boolean(m?.frozen),
        hasAnnotation: Boolean(m?.hasAnnotation),
      }),
    );
  }
  // Pad if doc longer than meta (should be rare).
  for (let i = n; i < lineCount; i++) {
    items.push({ stage: null, frozen: false, hasAnnotation: false });
  }
  const indices = computeFilteredSegmentIndicesFromMatchInputs(items, criteria);
  if (lineCount > 0 && indices.length >= lineCount) return null;
  return new Set(indices);
}

function metaHasSetEffect(tr: Transaction): boolean {
  for (const e of tr.effects) {
    if (e.is(setSegmentMetaEffect)) return true;
  }
  return false;
}

function visibleSetsEqual(
  a: TranscriptFilterVisibleSet,
  b: TranscriptFilterVisibleSet,
): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (a.size !== b.size) return false;
  for (const idx of a) {
    if (!b.has(idx)) return false;
  }
  return true;
}

type FilterVisibilityState = {
  criteria: SegmentListFilterState | null;
  visible: TranscriptFilterVisibleSet;
  hiddenRuns: readonly FilterHiddenRun[];
  generation: number;
  decorations: DecorationSet;
};

/**
 * Hide non-matching segment lines while keeping one-line-per-segment idx mapping.
 * Stores criteria so structure TX can recompute visibility in the same transaction.
 */
export const transcriptFilterVisibilityField = StateField.define<FilterVisibilityState>({
  create() {
    return {
      criteria: null,
      visible: null,
      hiddenRuns: [],
      generation: 0,
      decorations: Decoration.none,
    };
  },
  update(value, tr) {
    let criteria = value.criteria;
    let visible = value.visible;
    let forceProjection = false;

    for (const e of tr.effects) {
      if (e.is(setTranscriptFilterCriteriaEffect)) {
        criteria = e.value;
        forceProjection = true;
      }
      if (e.is(setTranscriptFilterVisibleEffect)) {
        visible = e.value;
        forceProjection = true;
      }
    }

    // Structure / meta refresh: recompute from criteria when React Set was not
    // also pushed in this TX (structureCommands pushes both).
    if (metaHasSetEffect(tr) && criteria != null && !isDefaultSegmentListFilter(criteria)) {
      let sawExplicitVisible = false;
      for (const e of tr.effects) {
        if (e.is(setTranscriptFilterVisibleEffect)) {
          sawExplicitVisible = true;
          break;
        }
      }
      if (!sawExplicitVisible) {
        visible = computeVisibleSetFromFilterCriteria(tr.state, criteria);
        forceProjection = true;
      }
    }

    if (forceProjection) {
      const rebuilt = buildHiddenLineDecorations(tr.state, visible);
      if (
        visibleSetsEqual(visible, value.visible) &&
        criteria === value.criteria &&
        rebuilt.hiddenRuns.length === value.hiddenRuns.length
      ) {
        let runsEqual = true;
        for (let i = 0; i < rebuilt.hiddenRuns.length; i++) {
          const a = rebuilt.hiddenRuns[i];
          const b = value.hiddenRuns[i];
          if (!a || !b || a.fromIdx !== b.fromIdx || a.toIdxInclusive !== b.toIdxInclusive) {
            runsEqual = false;
            break;
          }
        }
        if (runsEqual && !tr.docChanged) {
          return value.criteria === criteria
            ? value
            : { ...value, criteria };
        }
      }
      return {
        criteria,
        visible,
        hiddenRuns: rebuilt.hiddenRuns,
        generation: value.generation + 1,
        decorations: rebuilt.decorations,
      };
    }

    if (tr.docChanged) {
      // Same line count: rebuild decorations from cached runs (O(r)), not O(n) scan.
      if (tr.state.doc.lines === tr.startState.doc.lines && value.hiddenRuns.length > 0) {
        return {
          ...value,
          decorations: buildHiddenLineDecorationsFromRuns(tr.state, value.hiddenRuns),
        };
      }
      const rebuilt = buildHiddenLineDecorations(tr.state, visible);
      return {
        ...value,
        hiddenRuns: rebuilt.hiddenRuns,
        decorations: rebuilt.decorations,
      };
    }

    return value;
  },
  provide: (f) => EditorView.decorations.from(f, (v) => v.decorations),
});

export const transcriptFilterVisibilityTheme = EditorView.theme({
  // Empty last-line fallback only — primary path uses block collapse widgets.
  ".cm-line.cm-transcript-filter-hidden": {
    height: "0",
    minHeight: "0",
    maxHeight: "0",
    overflow: "hidden",
    padding: "0",
    margin: "0",
    border: "none",
    fontSize: "0",
    lineHeight: "0",
    pointerEvents: "none",
  },
  ".cm-transcript-filter-collapse": {
    display: "none",
  },
});

export function getTranscriptFilterVisibleSet(
  state: EditorState,
): TranscriptFilterVisibleSet {
  return state.field(transcriptFilterVisibilityField).visible;
}

export function getTranscriptFilterCriteria(
  state: EditorState,
): SegmentListFilterState | null {
  return state.field(transcriptFilterVisibilityField).criteria;
}

export function getTranscriptFilterHiddenRuns(
  state: EditorState,
): readonly FilterHiddenRun[] {
  return state.field(transcriptFilterVisibilityField).hiddenRuns;
}

export function getTranscriptFilterGeneration(state: EditorState): number {
  return state.field(transcriptFilterVisibilityField).generation;
}

/** True when filter is inactive, or `idx` is in the visible set. */
export function isTranscriptSegmentVisible(state: EditorState, idx: number): boolean {
  const visible = getTranscriptFilterVisibleSet(state);
  return visible == null || visible.has(idx);
}

/** Gutters must rebuild markers when filter visibility changes (hidden lines collapse to 0 height). */
export function transcriptFilterVisibilityChanged(update: ViewUpdate): boolean {
  return (
    update.startState.field(transcriptFilterVisibilityField) !==
    update.state.field(transcriptFilterVisibilityField)
  );
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
