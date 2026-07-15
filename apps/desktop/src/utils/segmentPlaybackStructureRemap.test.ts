import { describe, expect, it } from "vitest";
import type { SegmentDto } from "../tauri/projectApi";
import {
  resolveSegmentIdxContainingPlayhead,
  resolveStructurePlaybackRemap,
} from "./segmentPlaybackStructureRemap";

function seg(start: number, end: number, i = 0): SegmentDto {
  return {
    idx: i,
    start_sec: start,
    end_sec: end,
    text: "",
  };
}

describe("resolveSegmentIdxContainingPlayhead", () => {
  const parts = [seg(0, 10, 0), seg(10, 20, 1)];

  it("assigns seam time to the right segment", () => {
    expect(resolveSegmentIdxContainingPlayhead(parts, 10)).toBe(1);
    expect(resolveSegmentIdxContainingPlayhead(parts, 9.999)).toBe(0);
  });

  it("finds interior times", () => {
    expect(resolveSegmentIdxContainingPlayhead(parts, 5)).toBe(0);
    expect(resolveSegmentIdxContainingPlayhead(parts, 15)).toBe(1);
  });

  it("latches natural end onto last segment", () => {
    expect(resolveSegmentIdxContainingPlayhead(parts, 20)).toBe(1);
  });
});

describe("resolveStructurePlaybackRemap", () => {
  const parts = [seg(0, 10, 0), seg(10, 20, 1)];

  it("preserves pause time t on containing segment", () => {
    const r = resolveStructurePlaybackRemap({
      segments: parts,
      playheadSec: 12,
      hadAutoStopped: false,
      hadPausedAnchor: true,
    });
    expect(r.idx).toBe(1);
    expect(r.pausedAnchor).toEqual({ idx: 1, timeSec: 12 });
    expect(r.autoStoppedIdx).toBeNull();
    expect(r.session).toEqual({ kind: "segment", idx: 1 });
  });

  it("keeps natural-end sticky when playhead is still at the new block end", () => {
    const r = resolveStructurePlaybackRemap({
      segments: parts,
      playheadSec: 20,
      hadAutoStopped: true,
      hadPausedAnchor: false,
    });
    expect(r.autoStoppedIdx).toBe(1);
    expect(r.pausedAnchor).toBeNull();
  });

  it("clears natural-end sticky when merge leaves playhead mid-block", () => {
    // Old left segment ended at t=10; after merge [0,20] that latch is mid-block.
    const merged = [seg(0, 20, 0)];
    const r = resolveStructurePlaybackRemap({
      segments: merged,
      playheadSec: 10,
      hadAutoStopped: true,
      hadPausedAnchor: false,
    });
    expect(r.idx).toBe(0);
    expect(r.autoStoppedIdx).toBeNull();
    expect(r.pausedAnchor).toEqual({ idx: 0, timeSec: 10 });
    expect(r.session).toEqual({ kind: "segment", idx: 0 });
  });
});
