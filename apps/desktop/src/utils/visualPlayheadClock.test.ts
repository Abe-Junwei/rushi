import { describe, expect, it } from "vitest";
import {
  createVisualPlayheadClockState,
  readVisualPlayheadTimeSec,
} from "./visualPlayheadClock";

describe("visualPlayheadClock", () => {
  it("returns raw time without extrapolation", () => {
    const state = createVisualPlayheadClockState(1);
    expect(
      readVisualPlayheadTimeSec({
        state,
        nowMs: 32,
        rawTimeSec: 1,
        durationSec: 10,
        playbackRate: 1,
      }),
    ).toBe(1);
  });

  it("clamps to duration", () => {
    const state = createVisualPlayheadClockState(0);
    expect(
      readVisualPlayheadTimeSec({
        state,
        nowMs: 0,
        rawTimeSec: 12,
        durationSec: 10,
        playbackRate: 1,
      }),
    ).toBe(10);
  });

  it("clamps negative to zero", () => {
    const state = createVisualPlayheadClockState(0);
    expect(
      readVisualPlayheadTimeSec({
        state,
        nowMs: 0,
        rawTimeSec: -1,
        durationSec: 10,
        playbackRate: 1,
      }),
    ).toBe(0);
  });

  it("snaps to seek target", () => {
    const state = createVisualPlayheadClockState(1);
    expect(
      readVisualPlayheadTimeSec({
        state,
        nowMs: 100,
        rawTimeSec: 5,
        durationSec: 10,
        playbackRate: 1,
      }),
    ).toBe(5);
  });
});
