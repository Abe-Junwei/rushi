import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useState } from "react";
import type { SegmentDto } from "../tauri/projectTypes";
import {
  computeSegmentLassoOutcome,
  isContiguousIndexSelection,
  mergeSegmentRangeFold,
  rangeIndices,
  resolveSelectedIdxAfterIndexRemoval,
  toggleSegmentIndex,
} from "./segmentSelection";
import { useSegmentSelectionController } from "../pages/useSegmentSelectionController";

function seg(start: number, end: number, text = "x"): SegmentDto {
  return {
    uid: "u",
    idx: 0,
    start_sec: start,
    end_sec: end,
    text,
    confidence: null,
    low_confidence: false,
    detail: null,
  };
}

function useSelectionHarness(initialIdx = 0, count = 5) {
  const [selectedIdx, setSelectedIdx] = useState(initialIdx);
  const api = useSegmentSelectionController({
    selectedIdx,
    setSelectedIdx,
    segmentCount: count,
    resetKey: "file",
  });
  return { selectedIdx, setSelectedIdx, ...api };
}

describe("selection → batch op chain simulation", () => {
  it("shift range then merge uses contiguous lo..hi only", () => {
    const segments = [seg(0, 1, "a"), seg(1, 2, "b"), seg(2, 3, "c")];
    const { result } = renderHook(() => useSelectionHarness(0, 3));

    act(() => {
      result.current.selectSegmentAt(2, { shiftKey: true });
    });

    expect(result.current.isContiguousSelection).toBe(true);
    expect(result.current.selectionLo).toBe(0);
    expect(result.current.selectionHi).toBe(2);

    const merged = mergeSegmentRangeFold(segments, result.current.selectionLo, result.current.selectionHi);
    expect(merged.text).toBe("a\nb\nc");
  });

  it("toggle non-contiguous blocks merge but allows sparse delete indices", () => {
    const { result } = renderHook(() => useSelectionHarness(0, 5));

    act(() => {
      result.current.selectSegmentAt(0);
    });
    act(() => {
      result.current.selectSegmentAt(2, { toggle: true });
    });
    act(() => {
      result.current.selectSegmentAt(4, { toggle: true });
    });

    expect(result.current.selectedIndicesArray).toEqual([0, 2, 4]);
    expect(result.current.isContiguousSelection).toBe(false);
    expect(result.current.selectionLo).toBe(0);
    expect(result.current.selectionHi).toBe(4);
    // envelope 0..4 would wrongly merge index 1,3 if mergeSegmentRange(0,4) were called
    expect(isContiguousIndexSelection(rangeIndices(0, 4))).toBe(true);
    expect(isContiguousIndexSelection(new Set([0, 2, 4]))).toBe(false);
  });

  it("lasso adds intersecting indices; shift lasso extends base set", () => {
    const segments = [seg(0, 2), seg(2, 4), seg(4, 6), seg(6, 8)];
    const plain = computeSegmentLassoOutcome(segments, 1, 3.5, 8, new Set());
    expect(plain.mode).toBe("select");
    expect([...plain.indices].sort()).toEqual([0, 1]);

    const extended = computeSegmentLassoOutcome(segments, 5, 7, 8, new Set([0, 1]));
    expect([...extended.indices].sort()).toEqual([0, 1, 2, 3]);
  });

  it("toggle off last item falls back to single index 0", () => {
    const { result } = renderHook(() => useSelectionHarness(1, 3));

    act(() => {
      result.current.selectSegmentAt(1);
      result.current.selectSegmentAt(1, { toggle: true });
    });

    expect(result.current.selectedIndicesArray).toEqual([0]);
    expect(result.current.selectedIdx).toBe(0);
    expect(result.current.isIndexInSelection(0)).toBe(true);
  });
});

describe("resolveSelectedIdxAfterIndexRemoval", () => {
  it("maps primary when not removed", () => {
    expect(resolveSelectedIdxAfterIndexRemoval(5, [1, 3], 4)).toBe(2);
    expect(resolveSelectedIdxAfterIndexRemoval(5, [1, 3], 0)).toBe(0);
  });

  it("maps primary to next kept when removed", () => {
    expect(resolveSelectedIdxAfterIndexRemoval(5, [1, 3], 3)).toBe(2);
    expect(resolveSelectedIdxAfterIndexRemoval(5, [1, 3], 2)).toBe(1);
  });

  it("returns 0 when all removed", () => {
    expect(resolveSelectedIdxAfterIndexRemoval(2, [0, 1], 1)).toBe(0);
  });
});

describe("toggleSegmentIndex B1 seed", () => {
  it("seeds from primary when starting from empty set", () => {
    expect(toggleSegmentIndex(new Set(), 0, 2)).toEqual({
      indices: new Set([0, 2]),
      primaryIdx: 2,
    });
  });
});
