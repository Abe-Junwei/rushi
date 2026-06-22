import { describe, expect, it } from "vitest";
import {
  createVisualPlayheadClockState,
  readVisualPlayheadTimeSec,
} from "./visualPlayheadClock";

describe("visualPlayheadClock", () => {
  it("advances monotonically between sparse media samples", () => {
    const state = createVisualPlayheadClockState(0, 0);
    const t16 = readVisualPlayheadTimeSec({
      state,
      nowMs: 16,
      rawTimeSec: 0,
      durationSec: 10,
      playbackRate: 1,
    });
    const t32 = readVisualPlayheadTimeSec({
      state,
      nowMs: 32,
      rawTimeSec: 0,
      durationSec: 10,
      playbackRate: 1,
    });
    expect(t32).toBeGreaterThan(t16);
  });

  it("does not snap backward on sparse WS timeupdate", () => {
    const state = createVisualPlayheadClockState(1, 0);
    // rAF extrapolates slightly ahead while raw is still 1.0
    readVisualPlayheadTimeSec({
      state,
      nowMs: 40,
      rawTimeSec: 1,
      durationSec: 10,
      playbackRate: 1,
    });
    // WS timeupdate arrives with raw = 1.25. Visual must advance to at least
    // the new raw, not reset below the previous extrapolated position.
    const afterUpdate = readVisualPlayheadTimeSec({
      state,
      nowMs: 250,
      rawTimeSec: 1.25,
      durationSec: 10,
      playbackRate: 1,
    });
    expect(afterUpdate).toBeGreaterThanOrEqual(1.25);
  });

  it("extrapolates between sparse media samples without trailing raw", () => {
    const state = createVisualPlayheadClockState(1, 0);
    const t16 = readVisualPlayheadTimeSec({
      state,
      nowMs: 16,
      rawTimeSec: 1,
      durationSec: 10,
      playbackRate: 1,
    });
    const t32 = readVisualPlayheadTimeSec({
      state,
      nowMs: 32,
      rawTimeSec: 1,
      durationSec: 10,
      playbackRate: 1,
    });
    expect(t16).toBeGreaterThanOrEqual(1);
    expect(t32).toBeGreaterThan(t16);
    expect(t32).toBeLessThanOrEqual(1.05);
  });

  it("advances raw anchor when media time moves forward", () => {
    const state = createVisualPlayheadClockState(1, 0);
    readVisualPlayheadTimeSec({
      state,
      nowMs: 250,
      rawTimeSec: 1.25,
      durationSec: 10,
      playbackRate: 1,
    });
    expect(state.rawSec).toBe(1.25);
  });

  it("snaps on seek jumps", () => {
    const state = createVisualPlayheadClockState(1, 0);
    const jumped = readVisualPlayheadTimeSec({
      state,
      nowMs: 100,
      rawTimeSec: 5,
      durationSec: 10,
      playbackRate: 1,
    });
    expect(jumped).toBe(5);
  });
});
