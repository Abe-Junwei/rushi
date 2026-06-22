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

  it("snaps to raw on forward WS timeupdate instead of trailing", () => {
    const state = createVisualPlayheadClockState(1, 0);
    // Extrapolate slightly ahead while raw is still 1.0
    readVisualPlayheadTimeSec({
      state,
      nowMs: 40,
      rawTimeSec: 1,
      durationSec: 10,
      playbackRate: 1,
    });
    // WS timeupdate jumps raw forward — visual must not lag behind band canvas.
    const afterUpdate = readVisualPlayheadTimeSec({
      state,
      nowMs: 250,
      rawTimeSec: 1.25,
      durationSec: 10,
      playbackRate: 1,
    });
    expect(afterUpdate).toBe(1.25);
  });

  it("extrapolates between sparse media samples without trailing raw", () => {
    const state = createVisualPlayheadClockState(1, 0);
    state.lastRawSec = 1;
    state.lastRawNowMs = 0;
    state.emittedSec = 1;
    state.emittedNowMs = 0;
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

  it("extrapolates further when raw samples are stale", () => {
    const state = createVisualPlayheadClockState(1, 0);
    state.lastRawNowMs = 0;
    const t120 = readVisualPlayheadTimeSec({
      state,
      nowMs: 120,
      rawTimeSec: 1,
      durationSec: 10,
      playbackRate: 1,
    });
    expect(t120).toBeGreaterThan(1.05);
    expect(t120).toBeLessThanOrEqual(1.24);
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
