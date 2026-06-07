import { describe, expect, it } from "vitest";
import {
  selectOverlayInteractiveSegmentIndices,
  selectOverlayRenderedSegmentIndices,
} from "./waveformSegmentOverlayVisibility";

const segments = [
  { idx: 0, uid: "a", start_sec: 0, end_sec: 10, text: "a" },
  { idx: 1, uid: "b", start_sec: 50, end_sec: 60, text: "b" },
  { idx: 2, uid: "c", start_sec: 100, end_sec: 110, text: "c" },
] as const;

describe("selectOverlayRenderedSegmentIndices", () => {
  it("returns all packable segments for canvas band drawing", () => {
    expect(selectOverlayRenderedSegmentIndices({ segments: [...segments] })).toEqual([0, 1, 2]);
  });

  it("excludes dominant-span placeholders", () => {
    expect(
      selectOverlayRenderedSegmentIndices({
        segments: [...segments],
        dominantSpanIndices: [1],
      }),
    ).toEqual([0, 2]);
  });
});

describe("selectOverlayInteractiveSegmentIndices", () => {
  it("returns only selected and draft indices for DOM overlay", () => {
    expect(
      selectOverlayInteractiveSegmentIndices({
        segmentCount: 3,
        selectedIdx: 1,
        draftIdx: 2,
      }),
    ).toEqual([1, 2]);
  });

  it("dedupes when draft equals selected", () => {
    expect(
      selectOverlayInteractiveSegmentIndices({
        segmentCount: 3,
        selectedIdx: 1,
        draftIdx: 1,
      }),
    ).toEqual([1]);
  });

  it("returns every index in the multi-select range", () => {
    expect(
      selectOverlayInteractiveSegmentIndices({
        segmentCount: 8,
        selectedIdx: 5,
        selectionLo: 2,
        selectionHi: 5,
        draftIdx: null,
      }),
    ).toEqual([2, 3, 4, 5]);
  });

  it("includes index 0 when range starts at zero", () => {
    expect(
      selectOverlayInteractiveSegmentIndices({
        segmentCount: 4,
        selectedIdx: 2,
        selectionLo: 0,
        selectionHi: 2,
        draftIdx: null,
      }),
    ).toEqual([0, 1, 2]);
  });
});
