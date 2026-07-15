import { describe, expect, it, vi } from "vitest";
import {
  applyContextMenuSelectionBeforeOpen,
  shouldApplyContextMenuSelection,
} from "./segmentContextMenuSelection";

describe("segmentContextMenuSelection", () => {
  it("selects target segment for single-select context menu open", () => {
    expect(
      shouldApplyContextMenuSelection({
        segmentIdx: 3,
        isIndexInSelection: () => false,
        selectionCount: 1,
      }),
    ).toBe(true);
  });

  it("preserves multi-select when menu hits an already-selected row", () => {
    expect(
      shouldApplyContextMenuSelection({
        segmentIdx: 2,
        isIndexInSelection: (idx) => idx === 2,
        selectionCount: 3,
      }),
    ).toBe(false);
  });

  it("skips re-select when single-select already on the target row", () => {
    expect(
      shouldApplyContextMenuSelection({
        segmentIdx: 2,
        isIndexInSelection: (idx) => idx === 2,
        selectionCount: 1,
      }),
    ).toBe(false);
  });

  it("calls selectSegmentAt with contextMenu source before opening menu", () => {
    const selectSegmentAt = vi.fn();
    applyContextMenuSelectionBeforeOpen(
      {
        x: 0,
        y: 0,
        segmentIdx: 4,
        pointerTimeSec: 1,
        origin: "segmentList",
        selectionText: "",
      },
      {
        isIndexInSelection: () => false,
        selectionCount: 1,
      },
      selectSegmentAt,
    );
    expect(selectSegmentAt).toHaveBeenCalledWith(4, "contextMenu");
  });

  it("skips selectSegmentAt when multi-select should be preserved", () => {
    const selectSegmentAt = vi.fn();
    applyContextMenuSelectionBeforeOpen(
      {
        x: 0,
        y: 0,
        segmentIdx: 2,
        pointerTimeSec: 1,
        origin: "waveform",
        selectionText: "",
      },
      {
        isIndexInSelection: (idx) => idx === 2,
        selectionCount: 2,
      },
      selectSegmentAt,
    );
    expect(selectSegmentAt).not.toHaveBeenCalled();
  });
});
