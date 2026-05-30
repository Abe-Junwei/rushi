import { describe, expect, it } from "vitest";
import {
  clampCreateRangeClearOfSegments,
  describeCreateRangePolicyFailure,
  resolveCreateRangeForPolicy,
  segmentTimeRangesOverlap,
} from "./segmentTimeRange";

describe("segmentTimeRangesOverlap", () => {
  it("ignores touching boundaries", () => {
    expect(segmentTimeRangesOverlap(0, 5, 5, 10)).toBe(false);
    expect(segmentTimeRangesOverlap(5, 10, 0, 5)).toBe(false);
  });

  it("detects meaningful overlap", () => {
    expect(segmentTimeRangesOverlap(0, 5, 4.9, 10)).toBe(true);
    expect(segmentTimeRangesOverlap(1, 2, 0.5, 1.5)).toBe(true);
  });

  it("ignores sub-epsilon bleed", () => {
    expect(segmentTimeRangesOverlap(4.99, 5.01, 5, 10)).toBe(false);
  });
});

describe("clampCreateRangeClearOfSegments", () => {
  const segs = [
    { start_sec: 0, end_sec: 2 },
    { start_sec: 3, end_sec: 5 },
  ];

  it("keeps a range in a clear gap", () => {
    expect(clampCreateRangeClearOfSegments(segs, 2.2, 2.8)).toEqual({
      startSec: 2.2,
      endSec: 2.8,
    });
  });

  it("trims float bleed into neighbors", () => {
    expect(clampCreateRangeClearOfSegments(segs, 1.97, 2.12)).toEqual({
      startSec: 2,
      endSec: 2.12,
    });
    expect(clampCreateRangeClearOfSegments(segs, 2.88, 3.01)).toEqual({
      startSec: 2.88,
      endSec: 3.01,
    });
    expect(clampCreateRangeClearOfSegments(segs, 2.88, 3.05)).toEqual({
      startSec: 2.88,
      endSec: 3,
    });
  });

  it("returns null when the range is mostly over an existing segment", () => {
    expect(clampCreateRangeClearOfSegments(segs, 0.5, 1.5)).toBeNull();
    expect(clampCreateRangeClearOfSegments(segs, 2.02, 2.04)).toBeNull();
  });
});

describe("resolveCreateRangeForPolicy", () => {
  const segs = [
    { start_sec: 0, end_sec: 2 },
    { start_sec: 3, end_sec: 5 },
  ];

  it("trim matches clampCreateRangeClearOfSegments (trims / rejects)", () => {
    expect(resolveCreateRangeForPolicy(segs, 1.97, 2.12, "trim")).toEqual(
      clampCreateRangeClearOfSegments(segs, 1.97, 2.12),
    );
    expect(resolveCreateRangeForPolicy(segs, 0.5, 1.5, "trim")).toBeNull();
  });

  it("defaults to trim when policy is omitted", () => {
    expect(resolveCreateRangeForPolicy(segs, 0.5, 1.5)).toBeNull();
    expect(resolveCreateRangeForPolicy(segs, 2.2, 2.8)).toEqual({ startSec: 2.2, endSec: 2.8 });
  });

  it("reject blocks any overlap and never trims", () => {
    // Float bleed into a neighbor → reject returns null (trim would have shaved it).
    expect(resolveCreateRangeForPolicy(segs, 1.97, 2.12, "reject")).toBeNull();
    // Fully clear gap → accepted as-is.
    expect(resolveCreateRangeForPolicy(segs, 2.2, 2.8, "reject")).toEqual({
      startSec: 2.2,
      endSec: 2.8,
    });
  });

  it("allow keeps the raw range even when it overlaps existing segments", () => {
    expect(resolveCreateRangeForPolicy(segs, 0.5, 1.5, "allow")).toEqual({
      startSec: 0.5,
      endSec: 1.5,
    });
    // Still rejects a sub-min-span selection.
    expect(resolveCreateRangeForPolicy(segs, 2.2, 2.21, "allow")).toBeNull();
  });
});

describe("describeCreateRangePolicyFailure", () => {
  const segs = [
    { start_sec: 0, end_sec: 2 },
    { start_sec: 3, end_sec: 5 },
  ];

  it("returns policy-specific messages", () => {
    expect(describeCreateRangePolicyFailure("reject", 0.5, 1.5, segs)).toContain("重叠");
    expect(describeCreateRangePolicyFailure("trim", 0.5, 1.5, segs)).toContain("重叠");
    expect(describeCreateRangePolicyFailure("trim", 2.1, 2.4, segs)).toContain("空隙");
  });
});
