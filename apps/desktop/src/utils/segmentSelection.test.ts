import { describe, expect, it } from "vitest";
import type { SegmentDto } from "../tauri/projectTypes";
import {
  computeSegmentLassoOutcome,
  mergeSegmentRangeFold,
  normalizeSegmentIndexRange,
  selectionRangeFromTimeMarquee,
  toggleSegmentIndex,
} from "./segmentSelection";

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

describe("segmentSelection", () => {
  it("normalizeSegmentIndexRange clamps and orders", () => {
    expect(normalizeSegmentIndexRange(4, 1, 10)).toEqual({ lo: 1, hi: 4 });
    expect(normalizeSegmentIndexRange(-1, 99, 5)).toEqual({ lo: 0, hi: 4 });
  });

  it("selectionRangeFromTimeMarquee picks intersecting index span", () => {
    const segments = [seg(0, 2), seg(2, 4), seg(4, 6), seg(6, 8)];
    expect(selectionRangeFromTimeMarquee(segments, 1, 5, 8)).toEqual({ lo: 0, hi: 2 });
  });

  it("mergeSegmentRangeFold joins text without newlines", () => {
    const segments = [seg(0, 1, "a"), seg(1, 2, "b"), seg(2, 3, "c")];
    const merged = mergeSegmentRangeFold(segments, 0, 2);
    expect(merged.text).toBe("a b c");
    expect(merged.start_sec).toBe(0);
    expect(merged.end_sec).toBe(3);
  });

  it("mergeSegmentRangeFold uses live segment.text", () => {
    const segments = [
      { ...seg(0, 1, "a"), uid: "uid-a" },
      { ...seg(1, 2, "B*"), uid: "uid-b" },
    ];
    const merged = mergeSegmentRangeFold(segments, 0, 1);
    expect(merged.text).toBe("a B*");
  });

  it("computeSegmentLassoOutcome selects intersecting segments", () => {
    const segments = [seg(0, 2), seg(2, 4), seg(4, 6)];
    const outcome = computeSegmentLassoOutcome(segments, 1, 3.5, 6, new Set());
    expect(outcome.mode).toBe("select");
    expect(outcome.hitCount).toBe(2);
    expect([...outcome.indices].sort()).toEqual([0, 1]);
  });

  it("computeSegmentLassoOutcome skips indices outside listVisibleIndexSet", () => {
    const segments = [seg(0, 2), seg(2, 4), seg(4, 6)];
    const outcome = computeSegmentLassoOutcome(
      segments,
      1,
      3.5,
      6,
      new Set(),
      new Set([1]),
    );
    expect(outcome.mode).toBe("select");
    expect([...outcome.indices]).toEqual([1]);
  });

  it("toggleSegmentIndex seeds from primary when set is empty", () => {
    expect(toggleSegmentIndex(new Set(), 0, 2)).toEqual({
      indices: new Set([0, 2]),
      primaryIdx: 2,
    });
  });
});
