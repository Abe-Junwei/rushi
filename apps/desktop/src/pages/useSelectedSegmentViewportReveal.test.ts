// @vitest-environment jsdom

import { renderHook, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { commitSelectionChrome, resetSelectionChromeStoreForTests } from "../services/selection/selectionChromeStore";
import { useSelectedSegmentViewportReveal } from "./useSelectedSegmentViewportReveal";
import type { TranscriptionLayerInput } from "./transcriptionLayerTypes";

function makeCtx(): TranscriptionLayerInput {
  return {
    projectId: "p1",
    fileId: "f1",
    mediaUrl: null,
    segments: [
      { uid: "s0", idx: 0, start_sec: 0, end_sec: 1, text: "zero" },
      { uid: "s1", idx: 1, start_sec: 5, end_sec: 7, text: "one" },
    ],
    selectedIdx: 0,
    busy: false,
    selectionLo: 0,
    selectionHi: 0,
    selectionRangeAnchorIdx: 0,
    selectionCount: 1,
    isMultiSegmentSelection: false,
    isContiguousSelection: true,
    selectedIndicesArray: [0],
    isIndexInSelection: (idx) => idx === 0,
    selectSegmentAt: vi.fn(),
    selectSegmentRange: vi.fn(),
    selectSegmentIndices: vi.fn(),
    clearMultiSelection: vi.fn(),
    requestDeleteSelectedIndices: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    updateSegmentBounds: vi.fn(),
    insertSegmentFromTimeRange: vi.fn(),
    splitAtSelection: vi.fn(),
    splitAtPlayhead: vi.fn(),
    mergeWithNext: vi.fn(),
    mergeWithPrev: vi.fn(),
    mergeWithNextAt: vi.fn(),
    mergeWithPrevAt: vi.fn(),
    mergeSegmentRange: vi.fn(),
    insertSegmentAfter: vi.fn(),
    deleteSegmentAt: vi.fn(),
    requestDeleteSelection: vi.fn(),
    confirmSegmentEditAndAdvance: vi.fn(() => Promise.resolve(true)),
    saveSegments: vi.fn(() => Promise.resolve(true)),
    triggerFindReplaceShortcut: vi.fn(),
    closeFile: vi.fn(),
    openEnvironment: vi.fn(),
    openSegmentAnnotationDialog: vi.fn(),
    openManualCorrectionMemoryDialog: vi.fn(),
  };
}

describe("useSelectedSegmentViewportReveal", () => {
  beforeEach(() => {
    resetSelectionChromeStoreForTests();
  });

  it("reveals SC2 primary before React selectedIdx catches up", () => {
    const ctx = makeCtx();
    const revealSegmentInViewport = vi.fn();
    const ctxRef = { current: ctx };
    const timelineRef = {
      current: {
        timeline: {
          viewportFit: { revealSegmentInViewport },
        },
      },
    };

    commitSelectionChrome({
      fileId: "f1",
      primaryIdx: 1,
      selectedSet: new Set([1]),
    });

    const args = { ctxRef, timelineRef } as unknown as Parameters<
      typeof useSelectedSegmentViewportReveal
    >[0];
    const { result } = renderHook(() => useSelectedSegmentViewportReveal(args));

    act(() => result.current());

    expect(revealSegmentInViewport).toHaveBeenCalledWith({ start_sec: 5, end_sec: 7 });
  });
});
