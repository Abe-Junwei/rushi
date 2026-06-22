import { describe, expect, it } from "vitest";
import {
  selectOverlayInteractiveSegmentIndices,
  selectOverlayRenderedSegmentIndices,
  resolveSegmentBandCanvasSkipIndexSet,
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

  it("returns every index in the multi-select range when within cap", () => {
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

  it("caps contiguous multi-select DOM overlay above MAX_DOM_OVERLAY_SPARSE", () => {
    const out = selectOverlayInteractiveSegmentIndices({
      segmentCount: 100,
      selectedIdx: 50,
      selectionLo: 0,
      selectionHi: 49,
      selectionCount: 50,
      isContiguousSelection: true,
      draftIdx: null,
    });
    expect(out.length).toBeLessThanOrEqual(4);
    expect(out).toContain(50);
    expect(out).toContain(0);
    expect(out).toContain(49);
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

  it("fills contiguous range from selectedIndices when isContiguousSelection", () => {
    expect(
      selectOverlayInteractiveSegmentIndices({
        segmentCount: 5,
        selectedIdx: 0,
        selectedIndices: new Set([0, 1, 2, 3]),
        selectionLo: 0,
        selectionHi: 3,
        selectionCount: 4,
        isContiguousSelection: true,
        draftIdx: null,
      }),
    ).toEqual([0, 1, 2, 3]);
  });

  it("does not fill envelope gaps for sparse selectedIndices", () => {
    expect(
      selectOverlayInteractiveSegmentIndices({
        segmentCount: 5,
        selectedIdx: 4,
        selectedIndices: new Set([0, 2, 4]),
        selectionLo: 0,
        selectionHi: 4,
        selectionCount: 3,
        isContiguousSelection: false,
        draftIdx: null,
      }),
    ).toEqual([0, 2, 4]);
  });

  it("caps DOM overlay indices for very large sparse multi-select", () => {
    const selectedIndices = new Set<number>();
    for (let i = 0; i < 80; i += 2) selectedIndices.add(i);
    const out = selectOverlayInteractiveSegmentIndices({
      segmentCount: 80,
      selectedIdx: 40,
      selectedIndices,
      selectionLo: 0,
      selectionHi: 78,
      selectionCount: 40,
      isContiguousSelection: false,
      draftIdx: 79,
    });
    expect(out.length).toBeLessThan(40);
    expect(out).toContain(40);
    expect(out).toContain(79);
    expect(out).toContain(0);
    expect(out).toContain(78);
  });
});

describe("resolveSegmentBandCanvasSkipIndexSet", () => {
  it("skips primary when overlay DOM exists for primary", () => {
    const overlay = document.createElement("div");
    overlay.innerHTML = '<div data-segment-idx="3"></div>';

    const skip = resolveSegmentBandCanvasSkipIndexSet({
      segmentCount: 5,
      selectedIdx: 3,
      draftIdx: null,
      overlayRoot: overlay,
    });

    expect([...skip]).toEqual([3]);
  });

  it("band-paints primary when overlay DOM is missing", () => {
    const skip = resolveSegmentBandCanvasSkipIndexSet({
      segmentCount: 5,
      selectedIdx: 3,
      draftIdx: null,
      overlayRoot: null,
    });

    expect(skip.has(3)).toBe(false);
  });

  it("still skips non-primary overlay indices when mounted", () => {
    const overlay = document.createElement("div");
    overlay.innerHTML = '<div data-segment-idx="2"></div>';

    const skip = resolveSegmentBandCanvasSkipIndexSet({
      segmentCount: 5,
      selectedIdx: 3,
      selectionLo: 2,
      selectionHi: 3,
      selectionCount: 2,
      isContiguousSelection: true,
      draftIdx: null,
      overlayRoot: overlay,
    });

    expect(skip.has(3)).toBe(false);
    expect(skip.has(2)).toBe(true);
  });
});
