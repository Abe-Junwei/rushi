import { describe, expect, it, beforeEach } from "vitest";
import { commitSelectionChrome, getSelectionChromeSnapshot, resetSelectionChromeStoreForTests } from "./selectionChromeStore";
import { selectionChromeMatchesPreview } from "./selectionChromeMatchesPreview";
import type { TranscriptionLayerInput } from "../../pages/transcriptionLayerTypes";

function makeCtx(selectedIdx = 0): TranscriptionLayerInput {
  return {
    projectId: "p1",
    fileId: "f1",
    mediaUrl: null,
    segments: [
      { uid: "a", idx: 0, start_sec: 0, end_sec: 1, text: "a" },
      { uid: "b", idx: 1, start_sec: 2, end_sec: 3, text: "b" },
    ],
    selectedIdx,
    busy: false,
    selectionLo: selectedIdx,
    selectionHi: selectedIdx,
    selectionRangeAnchorIdx: selectedIdx,
    selectionCount: 1,
    isMultiSegmentSelection: false,
    isContiguousSelection: true,
    selectedIndicesArray: [selectedIdx],
    isIndexInSelection: (idx) => idx === selectedIdx,
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
    confirmSegmentEditAndAdvance: () => Promise.resolve(true),
    saveSegments: () => Promise.resolve(true),
    triggerFindReplaceShortcut: () => {},
    closeFile: () => {},
    openEnvironment: () => {},
    openSegmentAnnotationDialog: () => {},
    openManualCorrectionMemoryDialog: () => {},
  };
}

describe("selectionChromeMatchesPreview", () => {
  beforeEach(() => {
    resetSelectionChromeStoreForTests();
  });

  it("returns true when store matches single-select preview", () => {
    const ctx = makeCtx(0);
    commitSelectionChrome({ fileId: "f1", primaryIdx: 1, selectedSet: new Set([1]) });
    expect(selectionChromeMatchesPreview(ctx, 1)).toBe(true);
    expect(getSelectionChromeSnapshot().version).toBe(1);
  });

  it("returns false when primary differs", () => {
    commitSelectionChrome({ fileId: "f1", primaryIdx: 0, selectedSet: new Set([0]) });
    expect(selectionChromeMatchesPreview(makeCtx(0), 1)).toBe(false);
  });
});
