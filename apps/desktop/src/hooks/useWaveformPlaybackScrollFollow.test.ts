// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWaveformPlaybackScrollFollow } from "./useWaveformPlaybackScrollFollow";

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

  it("writes tier scroll to center playhead while playing", async () => {
    const tier = createTier(400);
    const tierScrollRef = { current: tier };
    const setTierScrollPx = vi.fn();

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
        setTierScrollPx,
      }),
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    // playhead at 50% → 1500px; center in 400px viewport → 1500 - 200 = 1300
    expect(setTierScrollPx).toHaveBeenCalledWith(1300, { deferLayoutCommit: true, immediate: true });
  });

  it("follows sub-2px target changes while playing", async () => {
    const tier = createTier(400);
    const tierScrollRef = { current: tier };
    const setTierScrollPx = vi.fn();
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
        setTierScrollPx,
      }),
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    playheadTimeSec = 15.006;

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(setTierScrollPx).toHaveBeenLastCalledWith(1300.6, { deferLayoutCommit: true, immediate: true });
  });

  it("edge mode keeps scroll when playhead stays in the middle band", async () => {
    const tier = createTier(400);
    const tierScrollRef = { current: tier };
    const setTierScrollPx = vi.fn();
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
        setTierScrollPx,
      }),
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(setTierScrollPx).not.toHaveBeenCalled();
  });

  it("does nothing when disabled", () => {
    const tier = createTier();
    const setTierScrollPx = vi.fn();

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
        setTierScrollPx,
      }),
    );

    act(() => {});
    expect(setTierScrollPx).not.toHaveBeenCalled();
  });

  it("pauses follow while user tier scroll suppress is active", async () => {
    const tier = createTier(400);
    const tierScrollRef = { current: tier };
    const setTierScrollPx = vi.fn();
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
        setTierScrollPx,
        userScrollSuppressUntilRef,
      }),
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(setTierScrollPx).not.toHaveBeenCalled();
  });
});
