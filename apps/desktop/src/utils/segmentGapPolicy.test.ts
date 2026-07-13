import { describe, expect, it } from "vitest";
import {
  clampSegmentBoundsToNeighbors,
  finalizeSegmentOverlayBounds,
  findSegmentInsertIndexByStart,
  resolveInsertAfterSpan,
  resolveResizeEatAgainstNeighbors,
  segmentBoundsMeetMinSpan,
} from "./segmentGapPolicy";

describe("segmentGapPolicy", () => {
  it("clampSegmentBoundsToNeighbors respects prev/next edges", () => {
    expect(
      clampSegmentBoundsToNeighbors(1, 4, { prevEndSec: 2, nextStartSec: 5 }),
    ).toEqual({ startSec: 2, endSec: 4 });
    expect(
      clampSegmentBoundsToNeighbors(1, 6, { prevEndSec: 0, nextStartSec: 3 }),
    ).toEqual({ startSec: 1, endSec: 3 });
  });

  it("resolveInsertAfterSpan uses gap fraction or tail default", () => {
    expect(resolveInsertAfterSpan({ prevEndSec: 2, nextStartSec: 5 })).toEqual({
      ok: true,
      startSec: 2,
      endSec: 3.35,
    });
    expect(resolveInsertAfterSpan({ prevEndSec: 10 })).toEqual({
      ok: true,
      startSec: 10,
      endSec: 11,
    });
    expect(resolveInsertAfterSpan({ prevEndSec: 2, nextStartSec: 2.05 }).ok).toBe(false);
  });

  it("resolveInsertAfterSpan clamps tail insert to media duration", () => {
    expect(resolveInsertAfterSpan({ prevEndSec: 99, mediaDurationSec: 100 })).toEqual({
      ok: true,
      startSec: 99,
      endSec: 100,
    });
  });

  it("finalizeSegmentOverlayBounds re-clamps resize-end to track duration after snap", () => {
    const out = finalizeSegmentOverlayBounds({
      bounds: { startSec: 90, endSec: 99.2 },
      mode: "resize-end",
      targets: [100],
      thresholdSec: 1,
      snapEnabled: true,
      durationSec: 100,
    });
    expect(out).toEqual({ startSec: 90, endSec: 100 });
  });

  it("findSegmentInsertIndexByStart returns length when append", () => {
    const segs = [{ start_sec: 0 }, { start_sec: 5 }];
    expect(findSegmentInsertIndexByStart(segs, 3)).toBe(1);
    expect(findSegmentInsertIndexByStart(segs, 10)).toBe(2);
  });

  it("segmentBoundsMeetMinSpan checks min span", () => {
    expect(segmentBoundsMeetMinSpan(0, 0.06)).toBe(true);
    expect(segmentBoundsMeetMinSpan(0, 0.01)).toBe(false);
  });

  it("resolveResizeEatAgainstNeighbors pushes next start when resize-end crosses", () => {
    const segs = [
      { start_sec: 0, end_sec: 1 },
      { start_sec: 1, end_sec: 2 },
    ];
    const out = resolveResizeEatAgainstNeighbors({
      mode: "resize-end",
      activeIdx: 0,
      rawStartSec: 0,
      rawEndSec: 1.4,
      segments: segs,
      minSpanSec: 0.05,
      durationSec: 10,
    });
    expect(out).toEqual({
      active: { startSec: 0, endSec: 1.4 },
      neighborPatches: [{ idx: 1, startSec: 1.4, endSec: 2 }],
      deleteIndices: [],
    });
  });

  it("resolveResizeEatAgainstNeighbors deletes next when below minSpan", () => {
    const segs = [
      { start_sec: 0, end_sec: 1 },
      { start_sec: 1, end_sec: 2 },
    ];
    const out = resolveResizeEatAgainstNeighbors({
      mode: "resize-end",
      activeIdx: 0,
      rawStartSec: 0,
      rawEndSec: 1.98,
      segments: segs,
      minSpanSec: 0.05,
      durationSec: 10,
    });
    expect(out).toEqual({
      active: { startSec: 0, endSec: 1.98 },
      neighborPatches: [],
      deleteIndices: [1],
    });
  });

  it("resolveResizeEatAgainstNeighbors chains delete then push on further neighbor", () => {
    const segs = [
      { start_sec: 0, end_sec: 1 },
      { start_sec: 1, end_sec: 1.5 },
      { start_sec: 1.5, end_sec: 3 },
    ];
    const out = resolveResizeEatAgainstNeighbors({
      mode: "resize-end",
      activeIdx: 0,
      rawStartSec: 0,
      rawEndSec: 2,
      segments: segs,
      minSpanSec: 0.05,
      durationSec: 10,
    });
    expect(out).toEqual({
      active: { startSec: 0, endSec: 2 },
      neighborPatches: [{ idx: 2, startSec: 2, endSec: 3 }],
      deleteIndices: [1],
    });
  });

  it("resolveResizeEatAgainstNeighbors pushes prev end on resize-start", () => {
    const segs = [
      { start_sec: 0, end_sec: 1 },
      { start_sec: 1, end_sec: 2 },
    ];
    const out = resolveResizeEatAgainstNeighbors({
      mode: "resize-start",
      activeIdx: 1,
      rawStartSec: 0.6,
      rawEndSec: 2,
      segments: segs,
      minSpanSec: 0.05,
      durationSec: 10,
    });
    expect(out).toEqual({
      active: { startSec: 0.6, endSec: 2 },
      neighborPatches: [{ idx: 0, startSec: 0, endSec: 0.6 }],
      deleteIndices: [],
    });
  });

  it("resolveResizeEatAgainstNeighbors move mode only clamps", () => {
    const segs = [
      { start_sec: 0, end_sec: 1 },
      { start_sec: 1, end_sec: 2 },
      { start_sec: 2, end_sec: 3 },
    ];
    const out = resolveResizeEatAgainstNeighbors({
      mode: "move",
      activeIdx: 1,
      rawStartSec: 0.5,
      rawEndSec: 1.5,
      segments: segs,
      minSpanSec: 0.05,
      durationSec: 10,
    });
    expect(out).toEqual({
      active: { startSec: 1, endSec: 1.5 },
      neighborPatches: [],
      deleteIndices: [],
    });
  });
});
