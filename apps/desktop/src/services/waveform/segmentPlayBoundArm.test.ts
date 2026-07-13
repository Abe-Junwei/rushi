import { describe, expect, it } from "vitest";
import {
  resolveLoopTogglePlayOptions,
  resolveSegmentBoundArmAfterPlayStart,
  shouldPlayThisSegmentInsteadOfPause,
} from "./segmentPlayBoundArm";

describe("segmentPlayBoundArm", () => {
  it("arms mid-segment resume near the tail", () => {
    const arm = resolveSegmentBoundArmAfterPlayStart({
      startAtSec: 9.0,
      rangeStart: 0,
      rangeEnd: 10,
      generation: 3,
    });
    expect(arm.unboundedSelectedPlayGen).toBeNull();
    expect(arm.bound).toEqual({
      startSec: 0,
      endSec: 10,
      generation: 3,
      armed: true,
    });
  });

  it("leaves restart-from-start unarmed", () => {
    const arm = resolveSegmentBoundArmAfterPlayStart({
      startAtSec: 0.01,
      rangeStart: 0,
      rangeEnd: 10,
      generation: 2,
    });
    expect(arm.bound?.armed).toBe(false);
    expect(arm.unboundedSelectedPlayGen).toBeNull();
  });

  it("marks unbounded when starting past segment end", () => {
    const arm = resolveSegmentBoundArmAfterPlayStart({
      startAtSec: 10.5,
      rangeStart: 0,
      rangeEnd: 10,
      generation: 7,
    });
    expect(arm.bound).toBeNull();
    expect(arm.unboundedSelectedPlayGen).toBe(7);
  });

  it("plays this segment instead of pause when no scoped chrome", () => {
    expect(
      shouldPlayThisSegmentInsteadOfPause({
        segmentBoundStopInFlight: false,
        activeScopedBound: false,
        activeUnboundedSelected: false,
      }),
    ).toBe(true);
    expect(
      shouldPlayThisSegmentInsteadOfPause({
        segmentBoundStopInFlight: false,
        activeScopedBound: true,
        activeUnboundedSelected: false,
      }),
    ).toBe(false);
  });

  it("restarts loop from segment start when past end", () => {
    expect(
      resolveLoopTogglePlayOptions({
        playheadSec: 9.96,
        rangeStart: 1,
        rangeEnd: 10,
      }),
    ).toEqual({ fromSec: 1, loop: true });
    expect(
      resolveLoopTogglePlayOptions({
        playheadSec: 5,
        rangeStart: 1,
        rangeEnd: 10,
      }),
    ).toEqual({ loop: true });
  });
});
