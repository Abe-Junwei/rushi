import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useWaveformLiveClock } from "./useWaveformLiveClock";

describe("useWaveformLiveClock", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("updates display time when paused and currentTimeSec changes", () => {
    const formatMediaTime = (sec: number) => `${Math.floor(sec)}s`;
    const { result, rerender } = renderHook(
      (props: { currentTimeSec: number; isPlaying: boolean }) =>
        useWaveformLiveClock({
          isPlaying: props.isPlaying,
          isReady: true,
          currentTimeSec: props.currentTimeSec,
          getDisplayPlayheadTimeSec: () => props.currentTimeSec,
          formatMediaTime,
          durationSec: 600,
        }),
      { initialProps: { currentTimeSec: 0, isPlaying: false } },
    );

    expect(result.current.displayTimeLabel).toBe("0s");

    rerender({ currentTimeSec: 125, isPlaying: false });
    expect(result.current.displayTimeLabel).toBe("125s");
  });

  it("advances display time via subscribePlayheadFrame while playing", () => {
    const moves: number[] = [];
    const subscribePlayheadFrame = (cb: (timeSec: number) => void) => {
      cb(0.016);
      cb(0.032);
      return () => {};
    };

    renderHook(() =>
      useWaveformLiveClock({
        isPlaying: true,
        isReady: true,
        getDisplayPlayheadTimeSec: () => 0,
        formatMediaTime: (sec) => `${sec}`,
        durationSec: 10,
        onPlayheadMove: (timeSec) => moves.push(timeSec),
        subscribePlayheadFrame,
      }),
    );

    expect(moves.length).toBeGreaterThanOrEqual(2);
    expect(moves[1]).toBeGreaterThan(moves[0]);
  });
});
