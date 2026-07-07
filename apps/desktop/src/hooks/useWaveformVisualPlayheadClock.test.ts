import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  flushTierScrollFrameForTests,
  resetTierScrollFrameCoordinatorForTests,
} from "../utils/tierScrollFrameCoordinator";
import {
  PLAYHEAD_FRAME_PRIORITY_PLAYHEAD,
  PLAYHEAD_FRAME_PRIORITY_SCROLL,
  useWaveformVisualPlayheadClock,
} from "./useWaveformVisualPlayheadClock";

describe("useWaveformVisualPlayheadClock single tick", () => {
  afterEach(() => {
    resetTierScrollFrameCoordinatorForTests();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("getDisplayPlayheadTimeSec does not recurse before waveform is ready", () => {
    const ws = {
      getCurrentTime: () => 2.25,
      setTime: vi.fn(),
      isPlaying: () => false,
    };
    const getPlayheadTime = vi.fn(() => ws.getCurrentTime());

    const { result } = renderHook(() =>
      useWaveformVisualPlayheadClock({
        isPlaying: false,
        isReady: false,
        durationSec: 0,
        currentTimeSec: 0,
        playbackRate: 1,
        getPlayheadTime,
      }),
    );

    expect(result.current.getDisplayPlayheadTimeSec()).toBe(2.25);
    expect(getPlayheadTime).toHaveBeenCalledTimes(1);
  });

  it("notifies subscribers in priority order via WS audioprocess + unified viewport frame", () => {
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });

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
      result.current.onWsAudioprocess(1.25);
      flushTierScrollFrameForTests();
    });

    expect(order).toEqual(["scroll", "playhead"]);
    expect(seen).toEqual([1.25]);
    expect(result.current.getVisualPlayheadTimeSec()).toBe(1.25);
  });

  it("onWsAudioprocess advances visual clock before React isPlaying commits", () => {
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });

    const { result } = renderHook(() =>
      useWaveformVisualPlayheadClock({
        isPlaying: false,
        isReady: true,
        durationSec: 30,
        currentTimeSec: 5,
        playbackRate: 1,
        getPlayheadTime: () => 5,
      }),
    );

    act(() => {
      result.current.onWsAudioprocess(5.4);
      flushTierScrollFrameForTests();
    });

    expect(result.current.getVisualPlayheadTimeSec()).toBe(5.4);
  });

  it("stops notifying after unsubscribe", () => {
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });

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
      result.current.onWsAudioprocess(1);
      flushTierScrollFrameForTests();
    });
    expect(hits.length).toBe(1);

    act(() => {
      unsub();
      result.current.onWsAudioprocess(2);
      flushTierScrollFrameForTests();
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
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });

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
      flushTierScrollFrameForTests();
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

  it("syncDisplayPlayheadAfterSeek snaps to seek target while playing", () => {
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });

    const { result } = renderHook(() =>
      useWaveformVisualPlayheadClock({
        isPlaying: true,
        isReady: true,
        durationSec: 30,
        currentTimeSec: 12,
        playbackRate: 1,
        getPlayheadTime: () => 12,
      }),
    );

    const seen: number[] = [];
    act(() => {
      result.current.subscribePlayheadFrame((t) => seen.push(t));
    });

    act(() => {
      result.current.syncDisplayPlayheadAfterSeek(5);
      flushTierScrollFrameForTests();
    });

    expect(seen).toEqual([5]);
    expect(result.current.getVisualPlayheadTimeSec()).toBe(5);
  });

  it("does not run a separate playing rAF loop (WS audioprocess drives ticks)", async () => {
    const source = await import("./useWaveformVisualPlayheadClock.ts?raw");
    expect(source.default).toContain("onWsAudioprocess");
    expect(source.default).toContain("schedulePlaybackViewportFrame");
    expect(source.default).not.toMatch(/requestAnimationFrame\(tick\)/);
  });
});
