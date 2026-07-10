import type { EditorView } from "@codemirror/view";
import { EditorView as EditorViewNs } from "@codemirror/view";
import { useSyncExternalStore } from "react";
import { segmentMetaField } from "./segmentMetaField";
import {
  primarySegmentIdx,
  transcriptMultiSelectionField,
} from "./selectionField";

export type TranscriptProjectionSnapshot = {
  primaryIdx: number;
  selectedSet: ReadonlySet<number>;
  rangeAnchor: number;
  metaVersion: number;
  lineCount: number;
};

const EMPTY_SET: ReadonlySet<number> = new Set();

const EMPTY_SNAPSHOT: TranscriptProjectionSnapshot = {
  primaryIdx: -1,
  selectedSet: EMPTY_SET,
  rangeAnchor: 0,
  metaVersion: 0,
  lineCount: 0,
};

let snapshot: TranscriptProjectionSnapshot = EMPTY_SNAPSHOT;
let metaVersion = 0;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
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

export function resetTranscriptProjectionForTests(): void {
  snapshot = EMPTY_SNAPSHOT;
  metaVersion = 0;
  listeners.clear();
}

/** Test-only: seed projection without mounting an EditorView. */
export function seedTranscriptProjectionForTests(
  next: Omit<TranscriptProjectionSnapshot, "metaVersion"> & { metaVersion?: number },
): void {
  metaVersion = next.metaVersion ?? metaVersion + 1;
  snapshot = {
    primaryIdx: next.primaryIdx,
    selectedSet: next.selectedSet,
    rangeAnchor: next.rangeAnchor,
    metaVersion,
    lineCount: next.lineCount,
  };
  emit();
}

function publishFromView(view: EditorView, bumpMeta: boolean): void {
  const { state } = view;
  const multi = state.field(transcriptMultiSelectionField);
  const primary = primarySegmentIdx(state);
  if (bumpMeta) metaVersion += 1;
  snapshot = {
    primaryIdx: primary,
    selectedSet: multi.selectedSet,
    rangeAnchor: multi.rangeAnchor,
    metaVersion,
    lineCount: state.doc.lines,
  };
  emit();
}

/**
 * Unidirectional CM6 → projection store. Waveform/scroll consumers subscribe;
 * they must never write selection back into this store.
 */
export function createTranscriptProjectionPublisher() {
  return EditorViewNs.updateListener.of((update) => {
    const selectionChanged =
      update.selectionSet ||
      update.startState.field(transcriptMultiSelectionField) !==
        update.state.field(transcriptMultiSelectionField);
    const metaChanged =
      update.startState.field(segmentMetaField) !== update.state.field(segmentMetaField);
    if (!update.docChanged && !selectionChanged && !metaChanged) return;
    publishFromView(update.view, metaChanged || update.docChanged);
  });
}

/** Seed projection after EditorView construction. */
export function syncTranscriptProjectionFromView(view: EditorView): void {
  publishFromView(view, true);
}

export function useTranscriptProjection(): TranscriptProjectionSnapshot {
  return useSyncExternalStore(
    subscribeTranscriptProjection,
    getTranscriptProjectionSnapshot,
    getTranscriptProjectionSnapshot,
  );
}

export function useTranscriptProjectionPrimaryIdx(): number {
  return useSyncExternalStore(
    subscribeTranscriptProjection,
    () => getTranscriptProjectionSnapshot().primaryIdx,
    () => getTranscriptProjectionSnapshot().primaryIdx,
  );
}
