import type { EditorView } from "@codemirror/view";
import { EditorView as EditorViewNs } from "@codemirror/view";
import { segmentMetaField } from "./segmentMetaField";
import {
  primarySegmentIdx,
  transcriptMultiSelectionField,
  transcriptMultiSelectionEqual,
} from "./selectionField";

export type TranscriptProjectionSnapshot = {
  primaryIdx: number;
  selectedSet: ReadonlySet<number>;
  rangeAnchor: number;
  selectionVersion: number;
  metaVersion: number;
  lineCount: number;
};

const EMPTY_SET: ReadonlySet<number> = new Set();

const EMPTY_SNAPSHOT: TranscriptProjectionSnapshot = {
  primaryIdx: -1,
  selectedSet: EMPTY_SET,
  rangeAnchor: 0,
  selectionVersion: 0,
  metaVersion: 0,
  lineCount: 0,
};

let snapshot: TranscriptProjectionSnapshot = EMPTY_SNAPSHOT;
let selectionVersion = 0;
let metaVersion = 0;
const listeners = new Set<() => void>();
const selectionListeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

function emitSelection(): void {
  for (const l of selectionListeners) l();
}

export function getTranscriptProjectionSnapshot(): TranscriptProjectionSnapshot {
  return snapshot;
}

export function subscribeTranscriptProjection(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function subscribeTranscriptSelectionProjection(listener: () => void): () => void {
  selectionListeners.add(listener);
  return () => {
    selectionListeners.delete(listener);
  };
}

export function resetTranscriptProjectionForTests(): void {
  snapshot = EMPTY_SNAPSHOT;
  selectionVersion = 0;
  metaVersion = 0;
  listeners.clear();
  selectionListeners.clear();
}

/** Test-only: seed projection without mounting an EditorView. */
export function seedTranscriptProjectionForTests(
  next: Omit<TranscriptProjectionSnapshot, "metaVersion" | "selectionVersion"> & {
    metaVersion?: number;
    selectionVersion?: number;
  },
): void {
  selectionVersion = next.selectionVersion ?? selectionVersion + 1;
  metaVersion = next.metaVersion ?? metaVersion + 1;
  snapshot = {
    primaryIdx: next.primaryIdx,
    selectedSet: next.selectedSet,
    rangeAnchor: next.rangeAnchor,
    selectionVersion,
    metaVersion,
    lineCount: next.lineCount,
  };
  emit();
  emitSelection();
}

function publishFromView(
  view: EditorView,
  opts: { bumpMeta: boolean; bumpSelection: boolean },
): void {
  const { state } = view;
  const multi = state.field(transcriptMultiSelectionField);
  const primary = primarySegmentIdx(state);
  if (opts.bumpSelection) selectionVersion += 1;
  if (opts.bumpMeta) metaVersion += 1;
  snapshot = {
    primaryIdx: primary,
    selectedSet: multi.selectedSet,
    rangeAnchor: multi.rangeAnchor,
    selectionVersion,
    metaVersion,
    lineCount: state.doc.lines,
  };
  emit();
  if (opts.bumpSelection) emitSelection();
}

/**
 * Unidirectional CM6 → projection store. Waveform/scroll consumers subscribe;
 * they must never write selection back into this store.
 */
export function createTranscriptProjectionPublisher() {
  return EditorViewNs.updateListener.of((update) => {
    const primaryChanged =
      primarySegmentIdx(update.startState) !== primarySegmentIdx(update.state);
    const selectionChanged =
      primaryChanged ||
      !transcriptMultiSelectionEqual(
        update.startState.field(transcriptMultiSelectionField),
        update.state.field(transcriptMultiSelectionField),
      );
    const metaChanged =
      update.startState.field(segmentMetaField) !== update.state.field(segmentMetaField);
    const lineCountChanged = update.startState.doc.lines !== update.state.doc.lines;
    if (!selectionChanged && !metaChanged && !lineCountChanged) return;
    publishFromView(update.view, {
      bumpMeta: metaChanged || lineCountChanged,
      bumpSelection: selectionChanged,
    });
  });
}

/** Seed projection after EditorView construction. */
export function syncTranscriptProjectionFromView(view: EditorView): void {
  publishFromView(view, { bumpMeta: true, bumpSelection: true });
}
