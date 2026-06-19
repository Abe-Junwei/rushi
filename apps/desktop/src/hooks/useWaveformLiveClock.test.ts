import { act, renderHook } from "@testing-library/react";
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

  it("advances visual playhead time between quantized media time samples", () => {
    const callbacks: FrameRequestCallback[] = [];
    let now = 0;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      callbacks.push(cb);
      return callbacks.length;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const moves: number[] = [];

    renderHook(() =>
      useWaveformLiveClock({
        isPlaying: true,
        isReady: true,
        getPlayheadTime: () => 0,
        formatMediaTime: (sec) => `${sec}`,
        durationSec: 10,
        playbackRate: 1,
        onPlayheadMove: (timeSec) => moves.push(timeSec),
      }),
    );

    act(() => {
      now = 16;
      callbacks.shift()?.(now);
      now = 32;
      callbacks.shift()?.(now);
    });

    expect(moves.length).toBeGreaterThanOrEqual(2);
    expect(moves[1]).toBeGreaterThan(moves[0]);
  });
});
