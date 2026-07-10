import { describe, expect, it } from "vitest";
import {
  collectSegmentBandSelectionDirtyIndices,
  expandSegmentBandDirtyIndices,
} from "./segmentBandDirtyPaint";

describe("segmentBandDirtyPaint", () => {
  it("expands neighbors for border redraw", () => {
    expect(expandSegmentBandDirtyIndices([5], 20)).toEqual([4, 5, 6]);
  });

  it("clamps neighbor expansion at timeline ends", () => {
    expect(expandSegmentBandDirtyIndices([0], 20)).toEqual([0, 1]);
    expect(expandSegmentBandDirtyIndices([19], 20)).toEqual([18, 19]);
  });

  it("collects previous and next primary indices", () => {
    expect(
      collectSegmentBandSelectionDirtyIndices({
        previousPrimaryIdx: 3,
        nextPrimaryIdx: 7,
        segmentCount: 20,
      }),
    ).toEqual([2, 3, 4, 6, 7, 8]);
  });

  it("falls back to full paint for large multi-select ranges", () => {
    expect(
      collectSegmentBandSelectionDirtyIndices({
        previousPrimaryIdx: 0,
        nextPrimaryIdx: 20,
        nextLo: 0,
        nextHi: 20,
        nextCount: 21,
        segmentCount: 62,
      }),
    ).toBeNull();
  });

  it("falls back when inclusive span exceeds eight segments", () => {
    expect(
      collectSegmentBandSelectionDirtyIndices({
        previousPrimaryIdx: 0,
        nextPrimaryIdx: 8,
        nextLo: 0,
        nextHi: 8,
        nextCount: 9,
        segmentCount: 62,
      }),
    ).toBeNull();
  });
});
