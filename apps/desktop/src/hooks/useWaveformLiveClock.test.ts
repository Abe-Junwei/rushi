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
    const getPlayheadTime = () => 0;

    const { result, rerender } = renderHook(
      (props: { currentTimeSec: number; isPlaying: boolean }) =>
        useWaveformLiveClock({
          isPlaying: props.isPlaying,
          isReady: true,
          currentTimeSec: props.currentTimeSec,
          getPlayheadTime,
          formatMediaTime,
          durationSec: 600,
        }),
      { initialProps: { currentTimeSec: 0, isPlaying: false } },
    );

    expect(result.current.displayTimeLabel).toBe("0s");

    rerender({ currentTimeSec: 125, isPlaying: false });
    expect(result.current.displayTimeLabel).toBe("125s");
  });

  it("advances visual playhead time via subscribePlayheadFrame while playing", () => {
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
        getPlayheadTime: () => 0,
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
