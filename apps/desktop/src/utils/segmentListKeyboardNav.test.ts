import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  resetTranscriptProjectionForTests,
  seedTranscriptProjectionForTests,
} from "../components/editor/core/transcriptProjection";
import {
  resolveAdjacentVisibleSegmentIdx,
  resolveListSelectionNavAnchor,
} from "./segmentListKeyboardNav";

describe("resolveAdjacentVisibleSegmentIdx", () => {
  const all = null;

  it("steps through full list when unfiltered", () => {
    expect(resolveAdjacentVisibleSegmentIdx(0, 1, 3, all)).toBe(1);
    expect(resolveAdjacentVisibleSegmentIdx(2, 1, 3, all)).toBeNull();
    expect(resolveAdjacentVisibleSegmentIdx(1, -1, 3, all)).toBe(0);
  });

  it("steps only within filtered indices", () => {
    const filtered = [0, 2, 5];
    expect(resolveAdjacentVisibleSegmentIdx(0, 1, 6, filtered)).toBe(2);
    expect(resolveAdjacentVisibleSegmentIdx(2, 1, 6, filtered)).toBe(5);
    expect(resolveAdjacentVisibleSegmentIdx(5, 1, 6, filtered)).toBeNull();
    expect(resolveAdjacentVisibleSegmentIdx(2, -1, 6, filtered)).toBe(0);
  });

  it("recovers toward next filtered index when selected segment is hidden", () => {
    const filtered = [2, 4];
    expect(resolveAdjacentVisibleSegmentIdx(1, 1, 6, filtered)).toBe(2);
    expect(resolveAdjacentVisibleSegmentIdx(1, -1, 6, filtered)).toBeNull();
    expect(resolveAdjacentVisibleSegmentIdx(5, -1, 6, filtered)).toBe(4);
    expect(resolveAdjacentVisibleSegmentIdx(5, 1, 6, filtered)).toBeNull();
  });

  it("returns null at filtered list boundaries", () => {
    const filtered = [2, 4, 7];
    expect(resolveAdjacentVisibleSegmentIdx(2, -1, 10, filtered)).toBeNull();
    expect(resolveAdjacentVisibleSegmentIdx(7, 1, 10, filtered)).toBeNull();
  });

  it("returns null when filter is active but empty", () => {
    expect(resolveAdjacentVisibleSegmentIdx(0, 1, 6, [])).toBeNull();
  });
});

describe("resolveListSelectionNavAnchor", () => {
  beforeEach(() => {
    resetTranscriptProjectionForTests();
  });

  afterEach(() => {
    resetTranscriptProjectionForTests();
  });

  it("prefers projection primary over stale React selectedIdx", () => {
    seedTranscriptProjectionForTests({
      primaryIdx: 3,
      selectedSet: new Set([3]),
      rangeAnchor: 3,
      lineCount: 5,
    });
    expect(resolveListSelectionNavAnchor(0)).toBe(3);
  });
});
