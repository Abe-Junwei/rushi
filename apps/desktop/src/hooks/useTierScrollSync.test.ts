// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTierScrollSync } from "./useTierScrollSync";

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
    syncWaveSurferScrollPx: vi.fn(),
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
    });

    act(() => {
      tier.scrollLeft = 96;
      result.current.onTierScroll();
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
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

    wfApi.syncWaveSurferScrollPx.mockClear();

    act(() => {
      result.current.setTierScrollPx(100);
      result.current.setTierScrollPx(120);
      result.current.setTierScrollPx(140);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(tier.scrollLeft).toBe(140);
    expect(wfApi.syncWaveSurferScrollPx).toHaveBeenCalledTimes(1);
    expect(wfApi.syncWaveSurferScrollPx).toHaveBeenCalledWith(140);
  });

  it("uses smooth DOM scrolling for setTierScrollPxSmooth", () => {
    const { el: tier, scrollToMock } = createTierContainer();
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
      result.current.setTierScrollPxSmooth(180);
    });

    expect(scrollToMock).toHaveBeenCalledWith({ left: 180, behavior: "smooth" });
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
});
