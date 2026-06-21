import { describe, expect, it } from "vitest";
import type { TranscriptionLayerInput } from "../../pages/transcriptionLayerTypes";
import { resolveSelectionChromePreview } from "./resolveSelectionChromePreview";

function makeCtx(overrides: Partial<TranscriptionLayerInput> = {}): TranscriptionLayerInput {
  return {
    projectId: "p1",
    fileId: "f1",
    mediaUrl: null,
    segments: Array.from({ length: 10 }, (_, idx) => ({
      uid: `s-${idx}`,
      idx,
      start_sec: idx,
      end_sec: idx + 1,
      text: `seg ${idx}`,
    })),
    selectedIdx: 2,
    busy: false,
    selectionLo: 2,
    selectionHi: 2,
    selectionRangeAnchorIdx: 2,
    selectionCount: 1,
    isMultiSegmentSelection: false,
    isContiguousSelection: true,
    selectedIndicesArray: [2],
    isIndexInSelection: (idx) => idx === 2,
    selectSegmentAt: () => {},
    selectSegmentRange: () => {},
    selectSegmentIndices: () => {},
    clearMultiSelection: () => {},
    requestDeleteSelectedIndices: () => {},
    undo: () => {},
    redo: () => {},
    updateSegmentBounds: () => {},
    insertSegmentFromTimeRange: () => null,
    splitAtSelection: () => {},
    splitAtPlayhead: () => {},
    mergeWithNext: () => {},
    mergeWithPrev: () => {},
    mergeWithNextAt: () => {},
    mergeWithPrevAt: () => {},
    mergeSegmentRange: () => {},
    insertSegmentAfter: () => {},
    deleteSegmentAt: () => {},
    requestDeleteSelection: () => {},
    confirmSegmentEditAndAdvance: async () => true,
    saveSegments: async () => true,
    triggerFindReplaceShortcut: () => {},
    closeFile: () => {},
    openEnvironment: () => {},
    openSegmentAnnotationDialog: () => {},
    openManualCorrectionMemoryDialog: () => {},
    ...overrides,
  };
}

describe("resolveSelectionChromePreview", () => {
  it("uses selectionRangeAnchorIdx for shift range preview", () => {
    const ctx = makeCtx({
      selectedIdx: 5,
      selectionRangeAnchorIdx: 2,
      selectedIndicesArray: [2, 3, 4, 5],
      selectionLo: 2,
      selectionHi: 5,
      selectionCount: 4,
      isMultiSegmentSelection: true,
      isIndexInSelection: (idx) => idx >= 2 && idx <= 5,
    });

    const preview = resolveSelectionChromePreview(ctx, 7, { shiftKey: true });
    expect(preview.primaryIdx).toBe(7);
    expect([...preview.selectedSet].sort((a, b) => a - b)).toEqual([2, 3, 4, 5, 6, 7]);
  });

  it("returns single selection for plain click", () => {
    const ctx = makeCtx();
    const preview = resolveSelectionChromePreview(ctx, 4);
    expect(preview.primaryIdx).toBe(4);
    expect([...preview.selectedSet]).toEqual([4]);
  });
});
