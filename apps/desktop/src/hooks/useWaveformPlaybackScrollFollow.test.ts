// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWaveformPlaybackScrollFollow } from "./useWaveformPlaybackScrollFollow";
import type { WaveformPlaybackScrollFollowMode } from "../utils/waveformPlaybackScrollFollow";
import {
  readPlaybackFractionalPx,
  resetTierScrollFrameCoordinatorForTests,
} from "../utils/tierScrollFrameCoordinator";
import {
  CENTER_FOLLOW_RECONCILE_PX,
  SUBPIXEL_DEBUG_AMPLIFY,
  clearPlaybackFollowDriving,
  isEdgeFollowDriving,
} from "../utils/waveformPlaybackSubpixel";

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
    resetTierScrollFrameCoordinatorForTests();
    clearPlaybackFollowDriving();
  });

  it("reconciles center scroll when |T − S| exceeds the freeze threshold", () => {
    const tier = createTier(400);
    const tierScrollRef = { current: tier };
    const playbackFollowScroll = vi.fn((px: number) => {
      tier.scrollLeft = px;
    });
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

    // playhead at 50% → 1500px; center in 400px viewport → 1500 - 200 = 1300 (> threshold from 0)
    expect(playbackFollowScroll).toHaveBeenCalledWith(1300);
    expect(readPlaybackFractionalPx()).toBe(0);
  });

  it("P1: freezes scrollLeft and broadcasts float offset when within reconcile threshold", () => {
    const tier = createTier(400);
    const tierScrollRef = { current: tier };
    const playbackFollowScroll = vi.fn((px: number) => {
      tier.scrollLeft = px;
    });
    const bus = createFrameBus();
    tier.scrollLeft = 1300;

    renderHook(() =>
      useWaveformPlaybackScrollFollow({
        tierScrollRef,
        timelineWidthPx: 3000,
        durationSec: 30,
        isPlaying: true,
        isReady: true,
        enabled: true,
        followMode: "center",
        getPlayheadTimeSec: () => 15.002,
        playbackFollowScroll,
        subscribePlayheadFrame: bus.subscribePlayheadFrame,
      }),
    );

    act(() => {
      bus.tick(15.002);
    });

    // 15.002/30 * 3000 = 1500.2 → center target 1300.2 → |0.2| < reconcile → no scroll write
    expect(playbackFollowScroll).not.toHaveBeenCalled();
    expect(readPlaybackFractionalPx()).toBeCloseTo(0.2 * SUBPIXEL_DEBUG_AMPLIFY, 5);
  });

  it("P1: sub-threshold target changes update offset without writing scroll", () => {
    const tier = createTier(400);
    const tierScrollRef = { current: tier };
    const playbackFollowScroll = vi.fn((px: number) => {
      tier.scrollLeft = px;
    });
    const bus = createFrameBus();
    tier.scrollLeft = 1300;
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
    expect(playbackFollowScroll).not.toHaveBeenCalled();
    expect(readPlaybackFractionalPx()).toBe(0);

    playheadTimeSec = 15.006;

    act(() => {
      bus.tick(15.006);
    });

    // 15.006/30 * 3000 = 1500.6 → center target 1300.6 → offset 0.6, no scroll write
    expect(playbackFollowScroll).not.toHaveBeenCalled();
    expect(readPlaybackFractionalPx()).toBeCloseTo(0.6 * SUBPIXEL_DEBUG_AMPLIFY, 5);
  });

  it("P1: reconciles when accumulated offset crosses the freeze threshold", () => {
    const tier = createTier(400);
    const tierScrollRef = { current: tier };
    const playbackFollowScroll = vi.fn((px: number) => {
      tier.scrollLeft = px;
    });
    const bus = createFrameBus();
    tier.scrollLeft = 1300;

    // Need Δscroll ≥ CENTER_FOLLOW_RECONCILE_PX. timeline 3000 / 30s → 100 px/s.
    // Δt = reconcile/100 + a little.
    const deltaSec = (CENTER_FOLLOW_RECONCILE_PX + 1) / 100;
    const timeSec = 15 + deltaSec;

    renderHook(() =>
      useWaveformPlaybackScrollFollow({
        tierScrollRef,
        timelineWidthPx: 3000,
        durationSec: 30,
        isPlaying: true,
        isReady: true,
        enabled: true,
        followMode: "center",
        getPlayheadTimeSec: () => timeSec,
        playbackFollowScroll,
        subscribePlayheadFrame: bus.subscribePlayheadFrame,
      }),
    );

    act(() => {
      bus.tick(timeSec);
    });

    const expectedTarget = timeSec / 30 * 3000 - 200;
    expect(playbackFollowScroll).toHaveBeenCalledWith(Math.round(expectedTarget));
    expect(Math.abs(readPlaybackFractionalPx())).toBeLessThanOrEqual(0.5 * SUBPIXEL_DEBUG_AMPLIFY + 1e-6);
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
    expect(readPlaybackFractionalPx()).toBe(0);
    expect(isEdgeFollowDriving()).toBe(false);
  });

  it("P1 edge page-drive: freezes scroll and sets driving without writing scroll under reconcile", () => {
    const tier = createTier(400);
    const tierScrollRef = { current: tier };
    const playbackFollowScroll = vi.fn((px: number) => {
      tier.scrollLeft = px;
    });
    const bus = createFrameBus();
    tier.scrollLeft = 0;

    // t=3.9 → playheadPx=390 > triggerHigh(352); target=390-60=330; |330| < 0.85*400=340
    renderHook(() =>
      useWaveformPlaybackScrollFollow({
        tierScrollRef,
        timelineWidthPx: 3000,
        durationSec: 30,
        isPlaying: true,
        isReady: true,
        enabled: true,
        followMode: "edge",
        getPlayheadTimeSec: () => 3.9,
        playbackFollowScroll,
        subscribePlayheadFrame: bus.subscribePlayheadFrame,
      }),
    );

    act(() => {
      bus.tick(3.9);
    });

    expect(playbackFollowScroll).not.toHaveBeenCalled();
    expect(tier.scrollLeft).toBe(0);
    expect(readPlaybackFractionalPx()).toBeCloseTo(330 * SUBPIXEL_DEBUG_AMPLIFY, 5);
    expect(isEdgeFollowDriving()).toBe(true);
  });

  it("P1 edge page-drive: reconciles when offset exceeds 0.85×viewport", () => {
    const tier = createTier(400);
    const tierScrollRef = { current: tier };
    const playbackFollowScroll = vi.fn((px: number) => {
      tier.scrollLeft = px;
    });
    const bus = createFrameBus();
    tier.scrollLeft = 0;

    // t=5 → playheadPx=500; target=440; |440| > 0.85*400=340 → reconcile
    renderHook(() =>
      useWaveformPlaybackScrollFollow({
        tierScrollRef,
        timelineWidthPx: 3000,
        durationSec: 30,
        isPlaying: true,
        isReady: true,
        enabled: true,
        followMode: "edge",
        getPlayheadTimeSec: () => 5,
        playbackFollowScroll,
        subscribePlayheadFrame: bus.subscribePlayheadFrame,
      }),
    );

    act(() => {
      bus.tick(5);
    });

    expect(playbackFollowScroll).toHaveBeenCalledWith(440);
    expect(Math.abs(readPlaybackFractionalPx())).toBeLessThanOrEqual(0.5 * SUBPIXEL_DEBUG_AMPLIFY + 1e-6);
    expect(isEdgeFollowDriving()).toBe(true);
  });

  it("P1: stopping playback sinks the offset into scrollLeft then clears it", () => {
    const tier = createTier(400);
    const tierScrollRef = { current: tier };
    const playbackFollowScroll = vi.fn((px: number) => {
      tier.scrollLeft = px;
    });
    const bus = createFrameBus();
    tier.scrollLeft = 1300;

    const { rerender } = renderHook(
      (props: { isPlaying: boolean }) =>
        useWaveformPlaybackScrollFollow({
          tierScrollRef,
          timelineWidthPx: 3000,
          durationSec: 30,
          isPlaying: props.isPlaying,
          isReady: true,
          enabled: true,
          followMode: "center",
          getPlayheadTimeSec: () => 15.002,
          playbackFollowScroll,
          subscribePlayheadFrame: bus.subscribePlayheadFrame,
        }),
      { initialProps: { isPlaying: true } },
    );

    act(() => {
      bus.tick(15.002);
    });
    expect(readPlaybackFractionalPx()).toBeCloseTo(0.2 * SUBPIXEL_DEBUG_AMPLIFY, 5);

    rerender({ isPlaying: false });
    // Cleanup sinks round(1300.2)=1300; paused snap may rewrite the same integer.
    expect(playbackFollowScroll).toHaveBeenCalledWith(1300, { deferLayoutCommit: false });
    expect(readPlaybackFractionalPx()).toBe(0);
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
