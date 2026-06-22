import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useStableTranscriptionLayerInput } from "./useStableTranscriptionLayerInput";
import type { ProjectControllerApi } from "./useProjectController";

function makeController(selectedIdx: number): ProjectControllerApi {
  return {
    current: { id: "p1" },
    currentFileId: "f1",
    audioSrc: "blob:a",
    audioStoragePath: "/a.wav",
    segments: [],
    selectedIdx,
    selectedIdxRef: { current: selectedIdx },
    busy: false,
    selectionLo: selectedIdx,
    selectionHi: selectedIdx,
    selectionRangeAnchorIdx: selectedIdx,
    selectionCount: 1,
    isMultiSegmentSelection: false,
    isContiguousSelection: true,
    selectedIndicesArray: [selectedIdx],
    isIndexInSelection: () => true,
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
    openSegmentAnnotationDialog: () => {},
    openManualCorrectionMemoryDialog: () => {},
  } as never;
}

describe("useStableTranscriptionLayerInput", () => {
  it("returns the same object reference across renders while syncing selectedIdx", () => {
    const { result, rerender } = renderHook(
      ({ idx }: { idx: number }) =>
        useStableTranscriptionLayerInput({
          controller: makeController(idx),
          openEnvironment: () => {},
          onOpenSegmentContextMenu: () => {},
        }),
      { initialProps: { idx: 0 } },
    );

    const first = result.current;
    rerender({ idx: 3 });
    expect(result.current).toBe(first);
    expect(result.current.selectedIdx).toBe(3);
  });
});
