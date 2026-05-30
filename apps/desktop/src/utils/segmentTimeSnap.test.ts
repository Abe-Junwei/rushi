import { describe, expect, it } from "vitest";
import {
  applySnapToDragBounds,
  collectSegmentSnapTargets,
  resolveSnapThresholdSec,
  snapSegmentRange,
  snapTimeSec,
} from "./segmentTimeSnap";

describe("segmentTimeSnap", () => {
  const segs = [
    { start_sec: 0, end_sec: 2 },
    { start_sec: 5, end_sec: 8 },
  ];

  it("collectSegmentSnapTargets includes track edges, playhead, and other segment bounds", () => {
    const targets = collectSegmentSnapTargets({
      segments: segs,
      durationSec: 10,
      playheadSec: 3,
    });
    expect(targets).toEqual([0, 2, 3, 5, 8, 10]);
  });

  it("excludes the segment being edited from snap targets", () => {
    const targets = collectSegmentSnapTargets({
      segments: segs,
      durationSec: 10,
      excludeSegmentIndex: 1,
    });
    expect(targets).not.toContain(5);
    expect(targets).not.toContain(8);
    expect(targets).toContain(2);
  });

  it("snapTimeSec snaps within threshold only", () => {
    expect(snapTimeSec(1.92, [0, 2, 5], 0.15)).toBe(2);
    expect(snapTimeSec(1.5, [0, 2, 5], 0.05)).toBe(1.5);
  });

  it("snapSegmentRange snaps both ends independently", () => {
    expect(snapSegmentRange(1.92, 4.95, [0, 2, 5], 0.15)).toEqual({
      startSec: 2,
      endSec: 5,
    });
  });

  it("applySnapToDragBounds move preserves span when start snaps", () => {
    const out = applySnapToDragBounds(
      { startSec: 1.92, endSec: 3.92 },
      "move",
      [0, 2, 5],
      0.15,
      true,
    );
    expect(out).toEqual({ startSec: 2, endSec: 4 });
  });

  it("applySnapToDragBounds resize-start snaps start only", () => {
    const out = applySnapToDragBounds(
      { startSec: 1.92, endSec: 8 },
      "resize-start",
      [0, 2, 5],
      0.15,
      true,
    );
    expect(out.startSec).toBe(2);
    expect(out.endSec).toBe(8);
  });

  it("resolveSnapThresholdSec scales with timeline width", () => {
    expect(resolveSnapThresholdSec(1000, 100)).toBeCloseTo(0.8, 5);
  });
});
