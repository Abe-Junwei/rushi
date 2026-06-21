import type { SegmentDto } from "../../tauri/projectApi";
import { applySelectionChromeImperative } from "./applySelectionChromeImperative";
import {
  clearUserSelectionChromePending,
  commitSelectionChrome,
  getSelectionChromeSnapshot,
  isUserSelectionChromePending,
  resetSelectionChrome,
  selectionSetsEqual,
  type SelectionChromeSnapshot,
} from "./selectionChromeStore";

export function reconcileSelectionChromeFromReact(input: {
  fileId: string | null;
  primaryIdx: number;
  selectedIndices: readonly number[];
  segments: readonly SegmentDto[];
  listRoot: ParentNode | null;
  overlayRoot: ParentNode | null;
}): boolean {
  if (input.fileId !== getSelectionChromeSnapshot().fileId) {
    resetSelectionChrome(input.fileId);
  }

  const selectedSet = new Set(input.selectedIndices);
  if (input.primaryIdx >= 0) {
    selectedSet.add(input.primaryIdx);
  }

  const snap = getSelectionChromeSnapshot();
  const storeMatchesReact =
    snap.primaryIdx === input.primaryIdx &&
    selectionSetsEqual(snap.selectedSet, selectedSet) &&
    snap.fileId === input.fileId;

  if (storeMatchesReact) {
    clearUserSelectionChromePending();
    return false;
  }

  const segmentCount = input.segments.length;
  const storeAheadOfReact =
    isUserSelectionChromePending(snap, segmentCount) &&
    snap.primaryIdx !== input.primaryIdx;

  if (storeAheadOfReact) return false;

  const prevSnapshot: SelectionChromeSnapshot = { ...snap };
  const nextSnapshot = commitSelectionChrome({
    fileId: input.fileId,
    primaryIdx: input.primaryIdx,
    selectedSet,
  });

  applySelectionChromeImperative({
    overlayRoot: input.overlayRoot,
    listRoot: input.listRoot,
    segments: input.segments,
    prevSnapshot,
    nextSnapshot,
  });

  clearUserSelectionChromePending();
  return true;
}
