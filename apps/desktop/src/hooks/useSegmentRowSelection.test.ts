// @vitest-environment jsdom

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  useSegmentRowSelection,
  useSelectionChromePrimaryIdx,
} from "./useSegmentRowSelection";
import { SELECTION_ROW_STATE } from "../services/selection/selectionRowState";
import {
  resetTranscriptProjectionForTests,
  seedTranscriptProjectionForTests,
} from "../components/editor/core/transcriptProjection";

describe("useSegmentRowSelection (P9b1 projection)", () => {
  beforeEach(() => {
    resetTranscriptProjectionForTests();
  });

  afterEach(() => {
    resetTranscriptProjectionForTests();
  });

  it("reads primary and in-selection from transcriptProjection", () => {
    seedTranscriptProjectionForTests({
      primaryIdx: 2,
      selectedSet: new Set([1, 2, 3]),
      rangeAnchor: 2,
      lineCount: 5,
    });

    const { result: primary } = renderHook(() => useSelectionChromePrimaryIdx());
    expect(primary.current).toBe(2);

    const { result: row2 } = renderHook(() => useSegmentRowSelection(2));
    expect(row2.current).toBe(SELECTION_ROW_STATE.primary);

    const { result: row1 } = renderHook(() => useSegmentRowSelection(1));
    expect(row1.current).toBe(SELECTION_ROW_STATE.inSelection);

    const { result: row9 } = renderHook(() => useSegmentRowSelection(9));
    expect(row9.current).toBe(SELECTION_ROW_STATE.none);
  });

  it("updates when projection is reseeded", () => {
    seedTranscriptProjectionForTests({
      primaryIdx: 0,
      selectedSet: new Set([0]),
      rangeAnchor: 0,
      lineCount: 3,
    });

    const { result, rerender } = renderHook(
      ({ idx }: { idx: number }) => useSegmentRowSelection(idx),
      { initialProps: { idx: 0 } },
    );
    expect(result.current).toBe(SELECTION_ROW_STATE.primary);

    act(() => {
      seedTranscriptProjectionForTests({
        primaryIdx: 1,
        selectedSet: new Set([1]),
        rangeAnchor: 1,
        lineCount: 3,
      });
    });
    rerender({ idx: 0 });
    expect(result.current).toBe(SELECTION_ROW_STATE.none);

    rerender({ idx: 1 });
    expect(result.current).toBe(SELECTION_ROW_STATE.primary);
  });
});
