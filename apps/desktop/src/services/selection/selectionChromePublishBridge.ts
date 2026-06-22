import type { SegmentDto } from "../../tauri/projectApi";
import { publishSelectionChrome } from "./publishSelectionChrome";
import { resetSelectionChrome } from "./selectionChromeStore";

type SelectionChromePublishRoots = {
  getListRoot: () => ParentNode | null;
  getOverlayRoot: () => ParentNode | null;
};

let publishRoots: SelectionChromePublishRoots | null = null;

export function registerSelectionChromePublishRoots(roots: SelectionChromePublishRoots | null): void {
  publishRoots = roots;
}

export function publishSelectionChromeForControllerState(input: {
  fileId: string | null;
  segments: readonly SegmentDto[];
  primaryIdx: number;
  selectedIndices: Iterable<number>;
}): void {
  if (!publishRoots) return;
  const selectedSet = new Set<number>();
  for (const raw of input.selectedIndices) {
    if (raw >= 0 && raw < input.segments.length) selectedSet.add(raw);
  }
  const primary =
    input.primaryIdx >= 0 && input.primaryIdx < input.segments.length
      ? input.primaryIdx
      : selectedSet.size > 0
        ? Math.min(...selectedSet)
        : -1;
  if (primary >= 0) selectedSet.add(primary);
  publishSelectionChrome({
    fileId: input.fileId,
    segments: input.segments,
    primaryIdx: primary,
    selectedSet,
    listRoot: publishRoots.getListRoot(),
    overlayRoot: publishRoots.getOverlayRoot(),
  });
}

export function resetSelectionChromeForFile(fileId: string | null): void {
  resetSelectionChrome(fileId);
}
