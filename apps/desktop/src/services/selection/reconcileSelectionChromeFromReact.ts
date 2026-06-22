import type { SegmentDto } from "../../tauri/projectApi";
import { clampSegmentIndex } from "../../utils/segmentSelection";
import { applySelectionChromeImperative } from "./applySelectionChromeImperative";
import {
  commitSelectionChrome,
  getSelectionChromeSnapshot,
  selectionSetsEqual,
  type SelectionChromeSnapshot,
} from "./selectionChromeStore";

export type ReconcileSelectionChromeInput = {
  fileId: string | null;
  primaryIdx: number;
  selectedIndices: readonly number[];
  segments: readonly SegmentDto[];
  listRoot: ParentNode | null;
  overlayRoot: ParentNode | null;
};

function buildReactSelectedSet(
  input: ReconcileSelectionChromeInput,
): { primaryIdx: number; selectedSet: Set<number> } {
  const selectedSet = new Set<number>();
  for (const raw of input.selectedIndices) {
    if (raw >= 0 && raw < input.segments.length) selectedSet.add(raw);
  }
  const primary = clampSegmentIndex(input.primaryIdx, input.segments.length);
  if (primary >= 0) selectedSet.add(primary);
  if (selectedSet.size === 0 && primary >= 0) selectedSet.add(primary);
  return { primaryIdx: primary, selectedSet };
}

export function selectionChromeNeedsReconcile(input: ReconcileSelectionChromeInput): boolean {
  if (!input.listRoot && !input.overlayRoot) return false;
  if (input.segments.length === 0) return false;

  const snap = getSelectionChromeSnapshot();
  const { primaryIdx, selectedSet } = buildReactSelectedSet(input);

  if (snap.fileId !== input.fileId) return true;
  if (snap.primaryIdx !== primaryIdx) return true;
  return !selectionSetsEqual(snap.selectedSet, selectedSet);
}

/** SC1/SC3 → SC2 safety net after React commit, filter, undo, or structure mutation. */
export function reconcileSelectionChromeFromReact(input: ReconcileSelectionChromeInput): boolean {
  if (!selectionChromeNeedsReconcile(input)) return false;

  const prevSnapshot: SelectionChromeSnapshot = getSelectionChromeSnapshot();
  const { primaryIdx, selectedSet } = buildReactSelectedSet(input);
  const nextSnapshot = commitSelectionChrome({
    fileId: input.fileId,
    primaryIdx,
    selectedSet,
  });

  if (nextSnapshot === prevSnapshot) return false;

  applySelectionChromeImperative({
    overlayRoot: input.overlayRoot,
    listRoot: input.listRoot,
    segments: input.segments,
    prevSnapshot,
    nextSnapshot,
  });

  return true;
}
