// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useWaveformVisualPlayheadClock } from "./useWaveformVisualPlayheadClock";

/** Regression: band canvas paint calls getDisplayPlayheadTimeSec before ws ready. */
describe("waveform playhead authority cycle", () => {
  it("does not recurse when authority ref points at visual clock before ready", () => {
    const ws = {
      getCurrentTime: () => 6.75,
      setTime: vi.fn(),
      isPlaying: () => false,
    };
    const authorityRef: { current: (() => number) | null } = { current: null };

    const clock = renderHook(() =>
      useWaveformVisualPlayheadClock({
        isPlaying: false,
        isReady: false,
        durationSec: 0,
        currentTimeSec: 0,
        playbackRate: 1,
        getEngineDisplayTimeSec: () => ws.getCurrentTime(),
      }),
    );

    authorityRef.current = clock.result.current.getDisplayPlayheadTimeSec;

    expect(clock.result.current.getDisplayPlayheadTimeSec()).toBe(6.75);
  });
});
