// @vitest-environment jsdom

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

/** Queue-based rAF — never invoke synchronously (playing loop would recurse forever). */
function stubQueuedRaf() {
  const rafQueue: FrameRequestCallback[] = [];
  const cancel = vi.fn((id: number) => {
    void id;
  });
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    rafQueue.push(cb);
    return rafQueue.length;
  });
  vi.stubGlobal("cancelAnimationFrame", cancel);
  return {
    rafQueue,
    cancel,
    flushOne: () => {
      const cb = rafQueue.shift();
      if (cb) cb(performance.now());
    },
    flushAll: () => {
      while (rafQueue.length > 0) {
        const cb = rafQueue.shift();
        if (cb) cb(performance.now());
      }
    },
  };
}

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
    const getEngineDisplayTimeSec = vi.fn(() => ws.getCurrentTime());

    const { result } = renderHook(() =>
      useWaveformVisualPlayheadClock({
        isPlaying: false,
        isReady: false,
        durationSec: 0,
        currentTimeSec: 0,
        playbackRate: 1,
        getEngineDisplayTimeSec,
      }),
    );

    expect(result.current.getDisplayPlayheadTimeSec()).toBe(2.25);
    expect(getEngineDisplayTimeSec).toHaveBeenCalledTimes(1);
  });

  it("notifies subscribers in priority order via playing rAF media poll", () => {
    const raf = stubQueuedRaf();
    let mediaSec = 1.25;
    const { result } = renderHook(() =>
      useWaveformVisualPlayheadClock({
        isPlaying: true,
        isReady: true,
        durationSec: 30,
        currentTimeSec: 0,
        playbackRate: 1,
        getEngineDisplayTimeSec: () => mediaSec,
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
      raf.flushOne();
      flushTierScrollFrameForTests();
    });

    expect(order).toEqual(["scroll", "playhead"]);
    expect(seen).toEqual([1.25]);
    expect(result.current.getVisualPlayheadTimeSec()).toBe(1.25);

    mediaSec = 1.5;
    act(() => {
      raf.flushOne();
      flushTierScrollFrameForTests();
    });
    expect(seen).toEqual([1.25, 1.5]);
  });

  it("stops playing rAF when live media reports not playing (before React isPlaying=false)", () => {
    const raf = stubQueuedRaf();
    let mediaSec = 2;
    let mediaPlaying = true;
    const { result } = renderHook(() =>
      useWaveformVisualPlayheadClock({
        isPlaying: true,
        isReady: true,
        durationSec: 30,
        currentTimeSec: 2,
        playbackRate: 1,
        getEngineDisplayTimeSec: () => mediaSec,
        getRawMediaIsPlaying: () => mediaPlaying,
      }),
    );

    act(() => {
      raf.flushOne();
      flushTierScrollFrameForTests();
    });
    expect(result.current.getVisualPlayheadTimeSec()).toBe(2);

    mediaPlaying = false;
    mediaSec = 2.05;
    const queuedAfterPause = raf.rafQueue.length;
    act(() => {
      raf.flushOne();
      flushTierScrollFrameForTests();
    });
    expect(result.current.getVisualPlayheadTimeSec()).toBe(2.05);
    // Loop must not re-queue after live pause.
    expect(raf.rafQueue.length).toBeLessThanOrEqual(queuedAfterPause);
  });

  it("onWsAudioprocess advances visual clock before React isPlaying commits", () => {
    const raf = stubQueuedRaf();
    void raf;

    const { result } = renderHook(() =>
      useWaveformVisualPlayheadClock({
        isPlaying: false,
        isReady: true,
        durationSec: 30,
        currentTimeSec: 5,
        playbackRate: 1,
        getEngineDisplayTimeSec: () => 5,
      }),
    );

    act(() => {
      result.current.onWsAudioprocess(5.4);
      flushTierScrollFrameForTests();
    });

    expect(result.current.getVisualPlayheadTimeSec()).toBe(5.4);
  });

  it("holds visual playhead at polled media time without extrapolation", () => {
    const raf = stubQueuedRaf();

    const { result } = renderHook(() =>
      useWaveformVisualPlayheadClock({
        isPlaying: true,
        isReady: true,
        durationSec: 30,
        currentTimeSec: 1,
        playbackRate: 1,
        getEngineDisplayTimeSec: () => 1,
      }),
    );

    act(() => {
      raf.flushOne();
      flushTierScrollFrameForTests();
    });
    const first = result.current.getVisualPlayheadTimeSec();

    act(() => {
      raf.flushOne();
      flushTierScrollFrameForTests();
    });
    const second = result.current.getVisualPlayheadTimeSec();

    expect(second).toBe(1);
    expect(first).toBe(1);
  });

  it("stops notifying after unsubscribe", () => {
    const raf = stubQueuedRaf();

    const { result } = renderHook(() =>
      useWaveformVisualPlayheadClock({
        isPlaying: true,
        isReady: true,
        durationSec: 30,
        currentTimeSec: 0,
        playbackRate: 1,
        getEngineDisplayTimeSec: () => 1,
      }),
    );

    const hits: number[] = [];
    let unsub = () => {};
    act(() => {
      unsub = result.current.subscribePlayheadFrame(() => hits.push(1));
    });

    act(() => {
      raf.flushOne();
      flushTierScrollFrameForTests();
    });
    expect(hits.length).toBe(1);

    act(() => {
      unsub();
      raf.flushOne();
      flushTierScrollFrameForTests();
    });
    expect(hits.length).toBe(1);
  });

  it("getDisplayPlayheadTimeSec returns visual time regardless of media while playing", () => {
    stubQueuedRaf();
    const { result, rerender } = renderHook(
      (props: { isPlaying: boolean }) =>
        useWaveformVisualPlayheadClock({
          isPlaying: props.isPlaying,
          isReady: true,
          durationSec: 30,
          currentTimeSec: 5,
          playbackRate: 1,
          getEngineDisplayTimeSec: () => 8,
        }),
      { initialProps: { isPlaying: false } },
    );

    expect(result.current.getDisplayPlayheadTimeSec()).toBe(5);

    rerender({ isPlaying: true });
    result.current.visualTimeSecRef.current = 7.25;
    expect(result.current.getDisplayPlayheadTimeSec()).toBe(7.25);
  });

  it("syncDisplayPlayheadAfterSeek notifies subscribers while paused", () => {
    stubQueuedRaf();

    const { result } = renderHook(() =>
      useWaveformVisualPlayheadClock({
        isPlaying: false,
        isReady: true,
        durationSec: 30,
        currentTimeSec: 2,
        playbackRate: 1,
        getEngineDisplayTimeSec: () => 2,
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
          getEngineDisplayTimeSec: () => props.currentTimeSec,
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

  it("does not pull visual backward to stale React currentTime after pause", () => {
    // While playing, React currentTime stays at the play-start seek; visual tracks media.
    // After pause, a stale currentTime commit must not rewind the visual clock.
    const { result, rerender } = renderHook(
      (props: { isPlaying: boolean; currentTimeSec: number }) =>
        useWaveformVisualPlayheadClock({
          isPlaying: props.isPlaying,
          isReady: true,
          durationSec: 30,
          currentTimeSec: props.currentTimeSec,
          playbackRate: 1,
          getEngineDisplayTimeSec: () => 15,
          getRawMediaIsPlaying: () => props.isPlaying,
        }),
      { initialProps: { isPlaying: true, currentTimeSec: 10 } },
    );

    act(() => {
      result.current.visualTimeSecRef.current = 15;
      result.current.syncDisplayPlayheadAfterSeek(15);
      rerender({ isPlaying: false, currentTimeSec: 10 });
    });

    expect(result.current.getVisualPlayheadTimeSec()).toBe(15);
  });

  it("syncDisplayPlayheadAfterSeek snaps to seek target while playing", () => {
    const raf = stubQueuedRaf();
    let mediaSec = 12;

    const { result } = renderHook(() =>
      useWaveformVisualPlayheadClock({
        isPlaying: true,
        isReady: true,
        durationSec: 30,
        currentTimeSec: 12,
        playbackRate: 1,
        getEngineDisplayTimeSec: () => mediaSec,
      }),
    );

    const seen: number[] = [];
    act(() => {
      result.current.subscribePlayheadFrame((t) => seen.push(t));
    });

    act(() => {
      result.current.syncDisplayPlayheadAfterSeek(5);
      mediaSec = 5; // mirrors ws.setTime completing in the same stack
      flushTierScrollFrameForTests();
    });

    expect(seen).toEqual([5]);
    expect(result.current.getVisualPlayheadTimeSec()).toBe(5);

    act(() => {
      raf.flushOne();
      flushTierScrollFrameForTests();
    });
    expect(result.current.getVisualPlayheadTimeSec()).toBe(5);
  });

  it("keeps segment-end latch when React isPlaying lags media pause", () => {
    // Natural-end finally latches display to endSec while React isPlaying is still
    // true; a late rAF freeze must not re-apply media overshoot past the band.
    const raf = stubQueuedRaf();
    let mediaSec = 22;
    let mediaPlaying = false;

    const { result } = renderHook(() =>
      useWaveformVisualPlayheadClock({
        isPlaying: true,
        isReady: true,
        durationSec: 30,
        currentTimeSec: 10,
        playbackRate: 1,
        getEngineDisplayTimeSec: () => mediaSec,
        getRawMediaIsPlaying: () => mediaPlaying,
      }),
    );

    act(() => {
      result.current.syncDisplayPlayheadAfterSeek(20);
      flushTierScrollFrameForTests();
    });
    expect(result.current.getVisualPlayheadTimeSec()).toBe(20);

    act(() => {
      raf.flushOne();
      flushTierScrollFrameForTests();
    });
    expect(result.current.getVisualPlayheadTimeSec()).toBe(20);
  });

  it("cancels playing rAF loop on pause", () => {
    const raf = stubQueuedRaf();
    const { rerender } = renderHook(
      (props: { isPlaying: boolean }) =>
        useWaveformVisualPlayheadClock({
          isPlaying: props.isPlaying,
          isReady: true,
          durationSec: 30,
          currentTimeSec: 1,
          playbackRate: 1,
          getEngineDisplayTimeSec: () => 1,
        }),
      { initialProps: { isPlaying: true } },
    );

    expect(raf.rafQueue.length).toBeGreaterThanOrEqual(1);
    const cancelsBeforePause = raf.cancel.mock.calls.length;

    act(() => {
      rerender({ isPlaying: false });
    });

    expect(raf.cancel.mock.calls.length).toBeGreaterThan(cancelsBeforePause);
  });

  it("playing rAF polls raw media without rate-based lead", async () => {
    const source = await import("./useWaveformVisualPlayheadClock.ts?raw");
    expect(source.default).toContain("getEngineDisplayTimeSec");
    expect(source.default).toContain("requestAnimationFrame(tick)");
    expect(source.default).not.toMatch(/playbackRate\s*\*/);
    expect(source.default).not.toMatch(/lastMedia.*elapsed|elapsed.*playbackRate/i);
  });
});
