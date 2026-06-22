import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PLAYHEAD_FRAME_PRIORITY_PLAYHEAD,
  PLAYHEAD_FRAME_PRIORITY_SCROLL,
  useWaveformVisualPlayheadClock,
} from "./useWaveformVisualPlayheadClock";

describe("useWaveformVisualPlayheadClock single tick", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("advances the clock then notifies subscribers in priority order in one frame", () => {
    const callbacks: FrameRequestCallback[] = [];
    let now = 0;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      callbacks.push(cb);
      return callbacks.length;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const { result } = renderHook(() =>
      useWaveformVisualPlayheadClock({
        isPlaying: true,
        isReady: true,
        durationSec: 30,
        currentTimeSec: 0,
        playbackRate: 1,
        getPlayheadTime: () => 0,
      }),
    );

    const order: string[] = [];
    const seen: number[] = [];
    act(() => {
      result.current.subscribePlayheadFrame((t) => {
        order.push("playhead");
        seen.push(t);
      }, PLAYHEAD_FRAME_PRIORITY_PLAYHEAD);
      result.current.subscribePlayheadFrame(() => order.push("scroll"), PLAYHEAD_FRAME_PRIORITY_SCROLL);
    });

    act(() => {
      now = 200;
      callbacks.shift()?.(now);
    });

    // Scroll (priority 0) runs before playhead (priority 1) within the same tick.
    expect(order).toEqual(["scroll", "playhead"]);
    // Subscriber receives the advanced (predicted) time, not the stale 0.
    expect(seen[0]).toBeGreaterThan(0);
    expect(seen[0]).toBeCloseTo(result.current.getVisualPlayheadTimeSec(), 5);
  });

  it("stops notifying after unsubscribe", () => {
    const callbacks: FrameRequestCallback[] = [];
    let now = 0;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      callbacks.push(cb);
      return callbacks.length;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const { result } = renderHook(() =>
      useWaveformVisualPlayheadClock({
        isPlaying: true,
        isReady: true,
        durationSec: 30,
        currentTimeSec: 0,
        playbackRate: 1,
        getPlayheadTime: () => 0,
      }),
    );

    const hits: number[] = [];
    let unsub = () => {};
    act(() => {
      unsub = result.current.subscribePlayheadFrame(() => hits.push(1));
    });

    act(() => {
      now = 100;
      callbacks.shift()?.(now);
    });
    expect(hits.length).toBe(1);

    act(() => {
      unsub();
      now = 200;
      callbacks.shift()?.(now);
    });
    expect(hits.length).toBe(1);
  });

  it("getDisplayPlayheadTimeSec uses visual time when paused and visual when playing", () => {
    const { result, rerender } = renderHook(
      (props: { isPlaying: boolean }) =>
        useWaveformVisualPlayheadClock({
          isPlaying: props.isPlaying,
          isReady: true,
          durationSec: 30,
          currentTimeSec: 5,
          playbackRate: 1,
          getPlayheadTime: () => 5,
        }),
      { initialProps: { isPlaying: false } },
    );

    expect(result.current.getDisplayPlayheadTimeSec()).toBe(5);

    rerender({ isPlaying: true });
    result.current.visualTimeSecRef.current = 7.25;
    expect(result.current.getDisplayPlayheadTimeSec()).toBe(7.25);
  });

  it("syncDisplayPlayheadAfterSeek notifies subscribers while paused", () => {
    const { result } = renderHook(() =>
      useWaveformVisualPlayheadClock({
        isPlaying: false,
        isReady: true,
        durationSec: 30,
        currentTimeSec: 2,
        playbackRate: 1,
        getPlayheadTime: () => 2,
      }),
    );

    const seen: number[] = [];
    act(() => {
      result.current.subscribePlayheadFrame((t) => seen.push(t));
    });

    act(() => {
      result.current.syncDisplayPlayheadAfterSeek(9.5);
    });

    expect(seen).toEqual([9.5]);
    expect(result.current.getVisualPlayheadTimeSec()).toBe(9.5);
  });

  it("ignores stale paused currentTimeSec until WS commit catches up to imperative seek", () => {
    const { result, rerender } = renderHook(
      (props: { currentTimeSec: number }) =>
        useWaveformVisualPlayheadClock({
          isPlaying: false,
          isReady: true,
          durationSec: 30,
          currentTimeSec: props.currentTimeSec,
          playbackRate: 1,
          getPlayheadTime: () => props.currentTimeSec,
        }),
      { initialProps: { currentTimeSec: 165 } },
    );

    act(() => {
      result.current.syncDisplayPlayheadAfterSeek(142);
    });
    expect(result.current.getVisualPlayheadTimeSec()).toBe(142);

    act(() => {
      rerender({ currentTimeSec: 165 });
    });
    expect(result.current.getVisualPlayheadTimeSec()).toBe(142);

    act(() => {
      rerender({ currentTimeSec: 142 });
    });
    expect(result.current.getVisualPlayheadTimeSec()).toBe(142);
  });

  it("does not restart playing rAF when currentTimeSec changes (S7)", async () => {
    const source = await import("./useWaveformVisualPlayheadClock.ts?raw");
    expect(source.default).toMatch(
      /useEffect\(\(\) => \{[\s\S]{0,900}requestAnimationFrame\(tick\);[\s\S]{0,120}\}, \[[^\]]*input\.durationSec[^\]]*\]\);/,
    );
    expect(source.default).not.toMatch(
      /useEffect\(\(\) => \{[\s\S]{0,900}requestAnimationFrame\(tick\);[\s\S]{0,120}\}, \[[^\]]*input\.currentTimeSec[^\]]*\]\);/,
    );
  });
});
