import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useRef } from "react";
import type { SegmentDto } from "../tauri/projectTypes";
import {
  computeSegmentLassoOutcome,
  isContiguousIndexSelection,
  mergeSegmentRangeFold,
  rangeIndices,
  resolveSelectedIdxAfterIndexRemoval,
  selectionEnvelope,
  toggleSegmentIndex,
} from "./segmentSelection";
import {
  resetTranscriptProjectionForTests,
  seedTranscriptProjectionForTests,
} from "../components/editor/core/transcriptProjection";
import { useTranscriptSelectionFromProjection } from "../pages/useTranscriptSelectionFromProjection";

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

describe("selection → batch op chain simulation", () => {
  it("shift range then merge uses contiguous lo..hi only", () => {
    const segments = [seg(0, 1, "a"), seg(1, 2, "b"), seg(2, 3, "c")];
    // Pure selection math (no CM6 view): shift from 0 → 2 yields contiguous 0..2.
    const selected = rangeIndices(0, 2);
    const envelope = selectionEnvelope(selected);
    expect(isContiguousIndexSelection(selected)).toBe(true);
    expect(envelope?.lo).toBe(0);
    expect(envelope?.hi).toBe(2);

    const merged = mergeSegmentRangeFold(segments, envelope!.lo, envelope!.hi);
    expect(merged.text).toBe("a\nb\nc");
  });

  it("toggle non-contiguous blocks merge but allows sparse delete indices", () => {
    let state = { indices: new Set([0]), primaryIdx: 0 };
    const t1 = toggleSegmentIndex(state.indices, state.primaryIdx, 2);
    expect(t1).not.toBeNull();
    state = t1!;
    const t2 = toggleSegmentIndex(state.indices, state.primaryIdx, 4);
    expect(t2).not.toBeNull();
    state = t2!;

    const selectedIndicesArray = [...state.indices].sort((a, b) => a - b);
    expect(selectedIndicesArray).toEqual([0, 2, 4]);
    expect(isContiguousIndexSelection(state.indices)).toBe(false);
    const envelope = selectionEnvelope(state.indices);
    expect(envelope?.lo).toBe(0);
    expect(envelope?.hi).toBe(4);
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

  it("toggle off last item falls back to null (caller collapses to single index)", () => {
    const result = toggleSegmentIndex(new Set([1]), 1, 1);
    expect(result).toBeNull();
  });
});

describe("useTranscriptSelectionFromProjection reads", () => {
  it("mirrors seeded projection primary and set", () => {
    resetTranscriptProjectionForTests();
    seedTranscriptProjectionForTests({
      primaryIdx: 2,
      selectedSet: new Set([0, 2]),
      rangeAnchor: 0,
      lineCount: 5,
    });

    const { result } = renderHook(() => {
      const selectedIdxRef = useRef(0);
      return useTranscriptSelectionFromProjection({
        segmentCount: 5,
        selectedIdxRef,
      });
    });

    expect(result.current.selectedIdx).toBe(2);
    expect(result.current.selectedIndicesArray).toEqual([0, 2]);
    expect(result.current.isContiguousSelection).toBe(false);
    expect(result.current.selectionLo).toBe(0);
    expect(result.current.selectionHi).toBe(2);

    act(() => {
      resetTranscriptProjectionForTests();
    });
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
