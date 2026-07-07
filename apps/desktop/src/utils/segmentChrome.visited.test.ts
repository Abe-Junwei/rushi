import { describe, expect, it } from "vitest";
import { resolveVisitedSegmentIndexAtPlayhead } from "./segmentChrome";

describe("resolveVisitedSegmentIndexAtPlayhead", () => {
  const segments = [
    { start_sec: 0, end_sec: 5 },
    { start_sec: 5, end_sec: 10 },
    { start_sec: 10, end_sec: 15 },
  ];

  it("returns -1 before first segment start", () => {
    expect(resolveVisitedSegmentIndexAtPlayhead(segments, 0)).toBe(-1);
  });

  it("returns latest visited segment index for playhead position", () => {
    expect(resolveVisitedSegmentIndexAtPlayhead(segments, 5.1)).toBe(1);
    expect(resolveVisitedSegmentIndexAtPlayhead(segments, 10.1)).toBe(2);
  });
});
