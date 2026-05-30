import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useWaveformLiveClock } from "./useWaveformLiveClock";

describe("useWaveformLiveClock", () => {
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
});
