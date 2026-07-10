// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTierScrollSync } from "./useTierScrollSync";
import {
  resetTierScrollFrameCoordinatorForTests,
  subscribeTierScrollFrame,
} from "../utils/tierScrollFrameCoordinator";

function createTierContainer(clientWidth = 320) {
  const el = document.createElement("div");
  let scrollLeft = 0;
  const scrollToMock = vi.fn((options?: ScrollToOptions | number, y?: number) => {
    if (typeof options === "number") {
      scrollLeft = options;
      void y;
      return;
    }
    scrollLeft = options?.left ?? scrollLeft;
  });
  Object.defineProperty(el, "clientWidth", {
    configurable: true,
    value: clientWidth,
  });
  Object.defineProperty(el, "scrollLeft", {
    configurable: true,
    get: () => scrollLeft,
    set: (value: number) => {
      scrollLeft = value;
    },
  });
  el.scrollTo = scrollToMock;
  return { el, scrollToMock };
}

function createWaveformApi() {
  return {
    isReady: true,
    duration: 30,
    clientXToTimeSec: vi.fn((clientX: number) => clientX / 10),
    seek: vi.fn(),
  };
}

const tierScrollDefaults = {
  mediaDurationSec: 30,
  pxPerSec: 40,
};

describe("useTierScrollSync", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      return window.setTimeout(() => cb(0), 0);
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => {
      window.clearTimeout(id);
    });
  });

  afterEach(() => {
    resetTierScrollFrameCoordinatorForTests();
    vi.unstubAllGlobals();
  });

  it("tracks tier scroll in layout state", async () => {
    const { el: tier } = createTierContainer();
    const tierScrollRef = { current: tier };
    const wfApiRef = { current: createWaveformApi() };

    const { result } = renderHook(() =>
      useTierScrollSync({
        tierScrollRef,
        timelineWidthPx: 1200,
        wfApiRef: wfApiRef as never,
        waveformReady: true,
        mediaUrl: "/audio.wav",
        ...tierScrollDefaults,
      }),
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
      await new Promise((r) => setTimeout(r, 0));
    });

    act(() => {
      tier.scrollLeft = 96;
      result.current.onTierScroll();
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 150));
    });

    expect(result.current.tierScrollLayout).toEqual({ clientWidthPx: 320, scrollLeftPx: 96 });
  });

  it("applies programmatic tier scroll", async () => {
    const { el: tier } = createTierContainer();
    const tierScrollRef = { current: tier };
    const wfApiRef = { current: createWaveformApi() };

    const { result } = renderHook(() =>
      useTierScrollSync({
        tierScrollRef,
        timelineWidthPx: 1200,
        wfApiRef: wfApiRef as never,
        waveformReady: true,
        mediaUrl: "/audio.wav",
        ...tierScrollDefaults,
      }),
    );

    act(() => {
      result.current.setTierScrollPx(144);
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    act(() => {
      result.current.onTierScroll();
    });

    expect(tier.scrollLeft).toBe(144);
    expect(result.current.tierScrollLayout).toEqual({ clientWidthPx: 320, scrollLeftPx: 144 });
  });

  it("defers layout commits for playback-follow programmatic scroll", async () => {
    const { el: tier } = createTierContainer();
    const tierScrollRef = { current: tier };
    const wfApiRef = { current: createWaveformApi() };

    const { result } = renderHook(() =>
      useTierScrollSync({
        tierScrollRef,
        timelineWidthPx: 1200,
        wfApiRef: wfApiRef as never,
        waveformReady: true,
        mediaUrl: "/audio.wav",
        ...tierScrollDefaults,
      }),
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    act(() => {
      result.current.setTierScrollPx(144, { deferLayoutCommit: true });
      tier.dispatchEvent(new Event("scroll"));
      result.current.onTierScroll();
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(tier.scrollLeft).toBe(144);
    expect(result.current.tierScrollLive.scrollLeftRef.current).toBe(144);
    expect(result.current.tierScrollLayout).toEqual({ clientWidthPx: 320, scrollLeftPx: 0 });

    act(() => {
      result.current.refreshTierScrollLayout();
    });

    expect(result.current.tierScrollLayout).toEqual({ clientWidthPx: 320, scrollLeftPx: 144 });
  });

  it("coalesces multiple programmatic writes into one frame commit", async () => {
    const { el: tier } = createTierContainer();
    const tierScrollRef = { current: tier };
    const wfApi = createWaveformApi();
    const wfApiRef = { current: wfApi };

    const { result } = renderHook(() =>
      useTierScrollSync({
        tierScrollRef,
        timelineWidthPx: 1200,
        wfApiRef: wfApiRef as never,
        waveformReady: true,
        mediaUrl: "/audio.wav",
        ...tierScrollDefaults,
      }),
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    const onFrame = vi.fn();
    const unsubscribe = subscribeTierScrollFrame(onFrame);

    act(() => {
      result.current.setTierScrollPx(100);
      result.current.setTierScrollPx(120);
      result.current.setTierScrollPx(140);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(tier.scrollLeft).toBe(140);
    expect(onFrame).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("flushes viewport chrome in the same turn for native scroll events", async () => {
    const { el: tier } = createTierContainer();
    const tierScrollRef = { current: tier };
    const wfApiRef = { current: createWaveformApi() };

    renderHook(() =>
      useTierScrollSync({
        tierScrollRef,
        timelineWidthPx: 1200,
        wfApiRef: wfApiRef as never,
        waveformReady: true,
        mediaUrl: "/audio.wav",
        ...tierScrollDefaults,
      }),
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    const onFrame = vi.fn();
    const unsubscribe = subscribeTierScrollFrame(onFrame);

    act(() => {
      tier.scrollLeft = 180;
      tier.dispatchEvent(new Event("scroll"));
    });

    expect(onFrame).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("applies wheel delta immediately through the tier scroll authority", () => {
    const { el: tier } = createTierContainer();
    const tierScrollRef = { current: tier };
    const wfApiRef = { current: createWaveformApi() };

    const { result } = renderHook(() =>
      useTierScrollSync({
        tierScrollRef,
        timelineWidthPx: 1200,
        wfApiRef: wfApiRef as never,
        waveformReady: true,
        mediaUrl: "/audio.wav",
        ...tierScrollDefaults,
      }),
    );

    const onFrame = vi.fn();
    const unsubscribe = subscribeTierScrollFrame(onFrame);

    act(() => {
      result.current.applyWheelScrollDelta(180);
      tier.dispatchEvent(new Event("scroll"));
    });

    expect(tier.scrollLeft).toBe(180);
    expect(onFrame).toHaveBeenCalled();
    unsubscribe();
  });

  it("cancels wheel motion when pointer interaction starts", async () => {
    const { el: tier } = createTierContainer();
    const tierScrollRef = { current: tier };
    const wfApiRef = { current: createWaveformApi() };

    const { result } = renderHook(() =>
      useTierScrollSync({
        tierScrollRef,
        timelineWidthPx: 1200,
        wfApiRef: wfApiRef as never,
        waveformReady: true,
        mediaUrl: "/audio.wav",
        ...tierScrollDefaults,
      }),
    );

    act(() => {
      result.current.applyWheelScrollDelta(180);
    });
    const scrollAtPointer = tier.scrollLeft;
    expect(scrollAtPointer).toBe(180);

    act(() => {
      result.current.cancelTransientScrollMotion("pointer");
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(tier.scrollLeft).toBe(scrollAtPointer);
  });

  it("native tier scroll cancels wheel motion before syncing DOM state", async () => {
    const { el: tier } = createTierContainer();
    const tierScrollRef = { current: tier };
    const wfApiRef = { current: createWaveformApi() };

    const { result } = renderHook(() =>
      useTierScrollSync({
        tierScrollRef,
        timelineWidthPx: 1200,
        wfApiRef: wfApiRef as never,
        waveformReady: true,
        mediaUrl: "/audio.wav",
        ...tierScrollDefaults,
      }),
    );

    act(() => {
      result.current.applyWheelScrollDelta(180);
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    act(() => {
      tier.scrollLeft = 24;
      tier.dispatchEvent(new Event("scroll"));
    });

    expect(tier.scrollLeft).toBe(24);
    expect(result.current.tierScrollLive.scrollLeftRef.current).toBe(24);
  });

  it("user scrub cancels wheel inertia and suppresses playback follow", async () => {
    const { el: tier } = createTierContainer();
    const tierScrollRef = { current: tier };
    const wfApiRef = { current: createWaveformApi() };
    const playbackFollowSuppressUntilRef = { current: 0 };

    const { result } = renderHook(() =>
      useTierScrollSync({
        tierScrollRef,
        timelineWidthPx: 1200,
        wfApiRef: wfApiRef as never,
        waveformReady: true,
        mediaUrl: "/audio.wav",
        playbackFollowSuppressUntilRef,
        ...tierScrollDefaults,
      }),
    );

    act(() => {
      result.current.applyWheelScrollDelta(180);
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    act(() => {
      result.current.userScrubScroll(72);
    });

    expect(tier.scrollLeft).toBe(72);
    expect(result.current.tierScrollLive.scrollLeftRef.current).toBe(72);
    expect(playbackFollowSuppressUntilRef.current).toBeGreaterThan(0);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 220));
    });
    expect(tier.scrollLeft).toBe(72);
  });

  it("selection reveal cancels wheel inertia and jumps immediately", async () => {
    const { el: tier } = createTierContainer();
    const tierScrollRef = { current: tier };
    const wfApiRef = { current: createWaveformApi() };

    const { result } = renderHook(() =>
      useTierScrollSync({
        tierScrollRef,
        timelineWidthPx: 1200,
        wfApiRef: wfApiRef as never,
        waveformReady: true,
        mediaUrl: "/audio.wav",
        ...tierScrollDefaults,
      }),
    );

    act(() => {
      result.current.applyWheelScrollDelta(180);
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    act(() => {
      result.current.revealSelectionScroll(320);
    });

    expect(tier.scrollLeft).toBe(320);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 220));
    });
    expect(tier.scrollLeft).toBe(320);
  });

  it("minimap scrub jumps directly through the tier scroll authority", () => {
    const { el: tier } = createTierContainer();
    const tierScrollRef = { current: tier };
    const wfApiRef = { current: createWaveformApi() };

    const { result } = renderHook(() =>
      useTierScrollSync({
        tierScrollRef,
        timelineWidthPx: 1200,
        wfApiRef: wfApiRef as never,
        waveformReady: true,
        mediaUrl: "/audio.wav",
        ...tierScrollDefaults,
      }),
    );

    act(() => {
      result.current.minimapScrubScroll(240);
    });

    expect(tier.scrollLeft).toBe(240);
    expect(result.current.tierScrollLive.scrollLeftRef.current).toBe(240);
  });

  it("playback follow writes scroll and defers React layout commit while playing", async () => {
    const { el: tier } = createTierContainer();
    const tierScrollRef = { current: tier };
    const wfApiRef = { current: createWaveformApi() };

    const { result } = renderHook(() =>
      useTierScrollSync({
        tierScrollRef,
        timelineWidthPx: 1200,
        wfApiRef: wfApiRef as never,
        waveformReady: true,
        mediaUrl: "/audio.wav",
        ...tierScrollDefaults,
      }),
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    const layoutBefore = result.current.tierScrollLayout.scrollLeftPx;

    act(() => {
      result.current.playbackFollowScroll(144);
    });

    expect(tier.scrollLeft).toBe(144);
    expect(result.current.tierScrollLive.scrollLeftRef.current).toBe(144);
    // Live DOM/refs update immediately; React layout stays deferred (prefs default).
    expect(result.current.tierScrollLayout.scrollLeftPx).toBe(layoutBefore);

    act(() => {
      result.current.refreshTierScrollLayout();
    });
    expect(result.current.tierScrollLayout.scrollLeftPx).toBe(144);
  });

  it("playback follow can force immediate layout commit via options", async () => {
    const { el: tier } = createTierContainer();
    const tierScrollRef = { current: tier };
    const wfApiRef = { current: createWaveformApi() };

    const { result } = renderHook(() =>
      useTierScrollSync({
        tierScrollRef,
        timelineWidthPx: 1200,
        wfApiRef: wfApiRef as never,
        waveformReady: true,
        mediaUrl: "/audio.wav",
        ...tierScrollDefaults,
      }),
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    act(() => {
      result.current.playbackFollowScroll(144, { deferLayoutCommit: false });
    });

    expect(tier.scrollLeft).toBe(144);
    expect(result.current.tierScrollLive.scrollLeftRef.current).toBe(144);
    expect(result.current.tierScrollLayout.scrollLeftPx).toBe(144);
  });

  it("playback follow flushes viewport chrome in the same frame as the scroll write", () => {
    const { el: tier } = createTierContainer();
    const tierScrollRef = { current: tier };
    const wfApiRef = { current: createWaveformApi() };

    const { result } = renderHook(() =>
      useTierScrollSync({
        tierScrollRef,
        timelineWidthPx: 1200,
        wfApiRef: wfApiRef as never,
        waveformReady: true,
        mediaUrl: "/audio.wav",
        ...tierScrollDefaults,
      }),
    );

    const onFrame = vi.fn();
    const unsubscribe = subscribeTierScrollFrame(onFrame);

    act(() => {
      result.current.playbackFollowScroll(144);
      tier.dispatchEvent(new Event("scroll"));
    });

    expect(tier.scrollLeft).toBe(144);
    expect(onFrame).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("clamps scroll when timeline floor is narrower than native width", async () => {
    const { el: tier } = createTierContainer(200);
    const tierScrollRef = { current: tier };
    const wfApiRef = { current: createWaveformApi() };

    const { result } = renderHook(() =>
      useTierScrollSync({
        tierScrollRef,
        timelineWidthPx: 320,
        mediaDurationSec: 1263,
        pxPerSec: 0.05,
        wfApiRef: wfApiRef as never,
        waveformReady: true,
        mediaUrl: "/audio.wav",
      }),
    );

    act(() => {
      result.current.setTierScrollPx(160);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(tier.scrollLeft).toBe(120);
  });

  it("preserves viewport center time when tier viewport width changes", async () => {
    const { el: tier } = createTierContainer(400);
    const tierScrollRef = { current: tier };
    const wfApiRef = { current: createWaveformApi() };

    const { result } = renderHook(
      () =>
        useTierScrollSync({
          tierScrollRef,
          timelineWidthPx: 4000,
          wfApiRef: wfApiRef as never,
          waveformReady: true,
          mediaUrl: "/audio.wav",
          ...tierScrollDefaults,
          mediaDurationSec: 100,
        }),
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    act(() => {
      result.current.setTierScrollPx(1000);
    });

    Object.defineProperty(tier, "clientWidth", { configurable: true, value: 800 });

    await act(async () => {
      result.current.refreshTierScrollLayout();
      await new Promise((r) => setTimeout(r, 0));
    });

    // center was 1000+200=1200px => 30s on 4000px / 100s; new vw=800 => sl = 1200-400=800
    expect(tier.scrollLeft).toBe(800);
  });

  it("immediate programmatic scroll still defers layout commits", async () => {
    const { el: tier } = createTierContainer();
    const tierScrollRef = { current: tier };
    const wfApiRef = { current: createWaveformApi() };

    const { result } = renderHook(() =>
      useTierScrollSync({
        tierScrollRef,
        timelineWidthPx: 1200,
        wfApiRef: wfApiRef as never,
        waveformReady: true,
        mediaUrl: "/audio.wav",
        ...tierScrollDefaults,
      }),
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    act(() => {
      result.current.setTierScrollPx(144, { deferLayoutCommit: true, immediate: true });
      tier.dispatchEvent(new Event("scroll"));
      result.current.onTierScroll();
    });

    expect(tier.scrollLeft).toBe(144);
    expect(result.current.tierScrollLive.scrollLeftRef.current).toBe(144);
    expect(result.current.tierScrollLayout.scrollLeftPx).toBe(0);

    act(() => {
      result.current.refreshTierScrollLayout();
    });

    expect(result.current.tierScrollLayout.scrollLeftPx).toBe(144);
  });

  it("preserves pending segment-fit scroll when timeline width changes", async () => {
    const { el: tier } = createTierContainer(800);
    const tierScrollRef = { current: tier };
    const wfApiRef = { current: createWaveformApi() };

    const { result, rerender } = renderHook(
      (props: Parameters<typeof useTierScrollSync>[0]) => useTierScrollSync(props),
      {
        initialProps: {
          tierScrollRef,
          timelineWidthPx: 4000,
          wfApiRef: wfApiRef as never,
          waveformReady: true,
          mediaUrl: "/audio.wav",
          ...tierScrollDefaults,
          mediaDurationSec: 600,
        },
      },
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    act(() => {
      result.current.setTierScrollPx(1200, { timelineWidthPx: 6000, immediate: true });
    });

    await act(async () => {
      rerender({
        tierScrollRef,
        timelineWidthPx: 6000,
        wfApiRef: wfApiRef as never,
        waveformReady: true,
        mediaUrl: "/audio.wav",
        ...tierScrollDefaults,
        mediaDurationSec: 600,
      });
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(tier.scrollLeft).toBe(1200);
  });

  it("does not extend playback-follow suppress for programmatic scroll writes", async () => {
    const { el: tier } = createTierContainer();
    const tierScrollRef = { current: tier };
    const wfApiRef = { current: createWaveformApi() };
    const playbackFollowSuppressUntilRef = { current: 0 };

    const { result } = renderHook(() =>
      useTierScrollSync({
        tierScrollRef,
        timelineWidthPx: 1200,
        wfApiRef: wfApiRef as never,
        waveformReady: true,
        mediaUrl: "/audio.wav",
        playbackFollowSuppressUntilRef,
        ...tierScrollDefaults,
      }),
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    act(() => {
      result.current.setTierScrollPx(120);
    });

    expect(playbackFollowSuppressUntilRef.current).toBe(0);
  });

  it("wheel scroll extends playback-follow suppress during playback-follow writes", async () => {
    const { el: tier } = createTierContainer();
    const tierScrollRef = { current: tier };
    const wfApiRef = { current: createWaveformApi() };
    const playbackFollowSuppressUntilRef = { current: 0 };

    const { result } = renderHook(() =>
      useTierScrollSync({
        tierScrollRef,
        timelineWidthPx: 1200,
        wfApiRef: wfApiRef as never,
        waveformReady: true,
        mediaUrl: "/audio.wav",
        playbackFollowSuppressUntilRef,
        ...tierScrollDefaults,
      }),
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    act(() => {
      result.current.playbackFollowScroll(100);
    });

    act(() => {
      result.current.applyWheelScrollDelta(40);
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(playbackFollowSuppressUntilRef.current).toBeGreaterThan(performance.now());
  });

  it("playback-follow scroll does not extend suppress from scroll events", async () => {
    const { el: tier } = createTierContainer();
    const tierScrollRef = { current: tier };
    const wfApiRef = { current: createWaveformApi() };
    const playbackFollowSuppressUntilRef = { current: 0 };

    const { result } = renderHook(() =>
      useTierScrollSync({
        tierScrollRef,
        timelineWidthPx: 1200,
        wfApiRef: wfApiRef as never,
        waveformReady: true,
        mediaUrl: "/audio.wav",
        playbackFollowSuppressUntilRef,
        ...tierScrollDefaults,
      }),
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    act(() => {
      result.current.playbackFollowScroll(100);
      tier.dispatchEvent(new Event("scroll"));
    });

    expect(playbackFollowSuppressUntilRef.current).toBe(0);
  });
});
