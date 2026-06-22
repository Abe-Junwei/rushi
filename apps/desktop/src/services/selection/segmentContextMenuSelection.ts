import type { SegmentContextMenuOpen } from "../../utils/segmentContextMenuModel";
import type { SegmentSelectSource } from "../../utils/waveformViewMode";

export function shouldApplyContextMenuSelection(input: {
  segmentIdx: number;
  isIndexInSelection: (idx: number) => boolean;
  selectionCount: number;
}): boolean {
  return !(input.isIndexInSelection(input.segmentIdx) && input.selectionCount > 1);
}

export function applyContextMenuSelectionBeforeOpen(
  menu: SegmentContextMenuOpen,
  ctx: {
    isIndexInSelection: (idx: number) => boolean;
    selectionCount: number;
  },
  selectSegmentAt: (idx: number, source: SegmentSelectSource) => void,
): void {
  if (
    shouldApplyContextMenuSelection({
      segmentIdx: menu.segmentIdx,
      isIndexInSelection: ctx.isIndexInSelection,
      selectionCount: ctx.selectionCount,
    })
  ) {
    selectSegmentAt(menu.segmentIdx, "contextMenu");
  }
}
