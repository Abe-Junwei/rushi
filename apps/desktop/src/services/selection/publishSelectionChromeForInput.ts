import type { TranscriptionLayerInput } from "../../pages/transcriptionLayerTypes";
import { publishSelectionChrome } from "./publishSelectionChrome";

export function publishSelectionChromeForInput(
  c: TranscriptionLayerInput,
  input: { primaryIdx: number; selectedSet: ReadonlySet<number> },
  roots: { listRoot: ParentNode | null; overlayRoot: ParentNode | null },
  opts?: { markFirstPaint?: boolean },
): void {
  publishSelectionChrome({
    fileId: c.fileId,
    segments: c.segments,
    primaryIdx: input.primaryIdx,
    selectedSet: input.selectedSet,
    listRoot: roots.listRoot,
    overlayRoot: roots.overlayRoot,
    markFirstPaint: opts?.markFirstPaint,
  });
}

export function publishSelectionChromeForIndices(
  c: TranscriptionLayerInput,
  indices: Iterable<number>,
  primaryIdx: number,
  roots: { listRoot: ParentNode | null; overlayRoot: ParentNode | null },
): { primaryIdx: number; selectedSet: Set<number> } {
  const selectedSet = new Set<number>();
  for (const raw of indices) {
    if (raw >= 0 && raw < c.segments.length) selectedSet.add(raw);
  }
  if (selectedSet.size === 0 && primaryIdx >= 0 && primaryIdx < c.segments.length) {
    selectedSet.add(primaryIdx);
  }
  const primary =
    selectedSet.size === 0
      ? -1
      : selectedSet.has(primaryIdx)
        ? primaryIdx
        : Math.min(...selectedSet);
  publishSelectionChromeForInput(c, { primaryIdx: primary, selectedSet }, roots);
  return { primaryIdx: primary, selectedSet };
}
