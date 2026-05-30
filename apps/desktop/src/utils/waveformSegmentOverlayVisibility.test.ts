import { describe, expect, it } from "vitest";
import { pickVisibleSegmentIndices } from "./waveformSegmentOverlayVisibility";

const segments = [
  { idx: 0, uid: "a", start_sec: 0, end_sec: 10, text: "a" },
  { idx: 1, uid: "b", start_sec: 50, end_sec: 60, text: "b" },
  { idx: 2, uid: "c", start_sec: 100, end_sec: 110, text: "c" },
] as const;

describe("pickVisibleSegmentIndices", () => {
  it("returns only segments in visible window plus selected", () => {
    const picked = pickVisibleSegmentIndices({
      segments: [...segments],
      durationSec: 120,
      timelineWidthPx: 1200,
      scrollLeftPx: 500,
      viewportWidthPx: 400,
      selectedIdx: 2,
    });
    expect(picked).toContain(1);
    expect(picked).toContain(2);
    expect(picked).not.toContain(0);
  });

  it("returns all indices when timeline width is zero", () => {
    const picked = pickVisibleSegmentIndices({
      segments: [...segments],
      durationSec: 120,
      timelineWidthPx: 0,
      scrollLeftPx: 0,
      viewportWidthPx: 400,
      selectedIdx: -1,
    });
    expect(picked).toEqual([0, 1, 2]);
  });
});
