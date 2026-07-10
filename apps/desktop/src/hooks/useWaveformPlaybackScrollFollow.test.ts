// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWaveformPlaybackScrollFollow } from "./useWaveformPlaybackScrollFollow";
import type { WaveformPlaybackScrollFollowMode } from "../utils/waveformPlaybackScrollFollow";

function createTier(clientWidth = 400) {
  const el = document.createElement("div");
  let scrollLeft = 0;
  Object.defineProperty(el, "clientWidth", { configurable: true, value: clientWidth });
  Object.defineProperty(el, "scrollLeft", {
    configurable: true,
    get: () => scrollLeft,
    set: (v: number) => {
      scrollLeft = v;
    },
  });
  return el;
}

/** Stand-in for the single playback tick bus; `tick()` drives subscribed follow. */
function createFrameBus() {
  const subs = new Set<(timeSec: number) => void>();
  return {
    subscribePlayheadFrame: (cb: (timeSec: number) => void) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    tick: (timeSec = 0) => {
      for (const cb of [...subs]) cb(timeSec);
    },
  };
}

describe("useWaveformPlaybackScrollFollow", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      return window.setTimeout(() => cb(0), 0);
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => {
      window.clearTimeout(id);
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("writes tier scroll to center playhead while playing", () => {
    const tier = createTier(400);
    const tierScrollRef = { current: tier };
    const playbackFollowScroll = vi.fn();
    const bus = createFrameBus();

    renderHook(() =>
      useWaveformPlaybackScrollFollow({
        tierScrollRef,
        timelineWidthPx: 3000,
        durationSec: 30,
        isPlaying: true,
        isReady: true,
        enabled: true,
        followMode: "center",
        getPlayheadTimeSec: () => 15,
        playbackFollowScroll,
        subscribePlayheadFrame: bus.subscribePlayheadFrame,
      }),
    );

    act(() => {
      bus.tick(15);
    });

    // playhead at 50% → 1500px; center in 400px viewport → 1500 - 200 = 1300
    expect(playbackFollowScroll).toHaveBeenCalledWith(1300);
  });

  it("follows sub-2px target changes while playing", () => {
    const tier = createTier(400);
    const tierScrollRef = { current: tier };
    const playbackFollowScroll = vi.fn();
    const bus = createFrameBus();
    let playheadTimeSec = 15;

    renderHook(() =>
      useWaveformPlaybackScrollFollow({
        tierScrollRef,
        timelineWidthPx: 3000,
        durationSec: 30,
        isPlaying: true,
        isReady: true,
        enabled: true,
        followMode: "center",
        getPlayheadTimeSec: () => playheadTimeSec,
        playbackFollowScroll,
        subscribePlayheadFrame: bus.subscribePlayheadFrame,
      }),
    );

    act(() => {
      bus.tick(15);
    });

    playheadTimeSec = 15.006;

    act(() => {
      bus.tick(15.006);
    });

    expect(playbackFollowScroll).toHaveBeenLastCalledWith(1300.6);
  });

  it("edge mode keeps scroll when playhead stays in the middle band", () => {
    const tier = createTier(400);
    const tierScrollRef = { current: tier };
    const playbackFollowScroll = vi.fn();
    const bus = createFrameBus();
    tier.scrollLeft = 1200;

    renderHook(() =>
      useWaveformPlaybackScrollFollow({
        tierScrollRef,
        timelineWidthPx: 3000,
        durationSec: 30,
        isPlaying: true,
        isReady: true,
        enabled: true,
        followMode: "edge",
        getPlayheadTimeSec: () => 15,
        playbackFollowScroll,
        subscribePlayheadFrame: bus.subscribePlayheadFrame,
      }),
    );

    act(() => {
      bus.tick(15);
    });

    expect(playbackFollowScroll).not.toHaveBeenCalled();
  });

  it("does nothing when disabled", () => {
    const tier = createTier();
    const playbackFollowScroll = vi.fn();
    const bus = createFrameBus();

    renderHook(() =>
      useWaveformPlaybackScrollFollow({
        tierScrollRef: { current: tier },
        timelineWidthPx: 3000,
        durationSec: 30,
        isPlaying: true,
        isReady: true,
        enabled: false,
        followMode: "center",
        getPlayheadTimeSec: () => 15,
        playbackFollowScroll,
        subscribePlayheadFrame: bus.subscribePlayheadFrame,
      }),
    );

    act(() => {
      bus.tick();
    });
    expect(playbackFollowScroll).not.toHaveBeenCalled();
  });

  it("centers playhead immediately when switching to center while paused", async () => {
    const tier = createTier(400);
    const tierScrollRef = { current: tier };
    const playbackFollowScroll = vi.fn();
    const bus = createFrameBus();

    const { rerender } = renderHook(
      (props: { followMode: WaveformPlaybackScrollFollowMode }) =>
        useWaveformPlaybackScrollFollow({
          tierScrollRef,
          timelineWidthPx: 3000,
          durationSec: 30,
          isPlaying: false,
          isReady: true,
          enabled: true,
          followMode: props.followMode,
          getPlayheadTimeSec: () => 15,
          playbackFollowScroll,
          subscribePlayheadFrame: bus.subscribePlayheadFrame,
        }),
      { initialProps: { followMode: "edge" as WaveformPlaybackScrollFollowMode } },
    );

    act(() => {
      bus.tick();
    });
    playbackFollowScroll.mockClear();

    rerender({ followMode: "center" });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(playbackFollowScroll).toHaveBeenCalledWith(1300, { deferLayoutCommit: false });
  });

  it("pauses follow while user tier scroll suppress is active", () => {
    const tier = createTier(400);
    const tierScrollRef = { current: tier };
    const playbackFollowScroll = vi.fn();
    const bus = createFrameBus();
    const userScrollSuppressUntilRef = { current: performance.now() + 5000 };

    renderHook(() =>
      useWaveformPlaybackScrollFollow({
        tierScrollRef,
        timelineWidthPx: 3000,
        durationSec: 30,
        isPlaying: true,
        isReady: true,
        enabled: true,
        followMode: "center",
        getPlayheadTimeSec: () => 15,
        playbackFollowScroll,
        userScrollSuppressUntilRef,
        subscribePlayheadFrame: bus.subscribePlayheadFrame,
      }),
    );

    act(() => {
      bus.tick();
    });

    expect(playbackFollowScroll).not.toHaveBeenCalled();
  });
});
