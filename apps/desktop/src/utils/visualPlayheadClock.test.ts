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
