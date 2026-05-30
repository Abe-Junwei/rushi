import { describe, expect, it } from "vitest";
import { selectOverlayRenderedSegmentIndices } from "./waveformSegmentOverlayVisibility";

const segments = [
  { idx: 0, uid: "a", start_sec: 0, end_sec: 10, text: "a" },
  { idx: 1, uid: "b", start_sec: 50, end_sec: 60, text: "b" },
  { idx: 2, uid: "c", start_sec: 100, end_sec: 110, text: "c" },
] as const;

describe("selectOverlayRenderedSegmentIndices", () => {
  it("renders every segment regardless of scroll/viewport (no virtualization)", () => {
    // Regression guard for "segments don't refresh after viewport scroll": the
    // render set must be scroll-independent, so far-apart off-screen segments are
    // always included.
    expect(selectOverlayRenderedSegmentIndices({ segments: [...segments] })).toEqual([0, 1, 2]);
  });

  it("excludes dominant-span placeholders so they cannot blanket the waveform", () => {
    expect(
      selectOverlayRenderedSegmentIndices({
        segments: [...segments],
        dominantSpanIndices: [1],
      }),
    ).toEqual([0, 2]);
  });

  it("returns empty for no segments", () => {
    expect(selectOverlayRenderedSegmentIndices({ segments: [] })).toEqual([]);
  });
});
