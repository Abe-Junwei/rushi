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

function createWaveformApi(scrollLeft: number) {
  return {
    isReady: true,
    duration: 30,
    getScrollLeft: vi.fn(() => scrollLeft),
    setScrollLeft: vi.fn(),
    clientXToTimeSec: vi.fn((clientX: number) => clientX / 10),
    seek: vi.fn(),
  };
}

describe("useTierScrollSync", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("pushes tier scroll changes back into the waveform instance", () => {
    const { el: tier } = createTierContainer();
    const tierScrollRef = { current: tier };
    const wfApiRef = { current: createWaveformApi(72) };

    const { result } = renderHook(() =>
      useTierScrollSync({
        tierScrollRef,
        timelineWidthPx: 1200,
        wfApiRef: wfApiRef as never,
        waveformReady: true,
        mediaUrl: "/audio.wav",
      }),
    );

    act(() => {
      tier.scrollLeft = 96;
      result.current.onTierScroll();
    });

    expect(wfApiRef.current.setScrollLeft).toHaveBeenCalledWith(96);
    expect(result.current.tierScrollLayout).toEqual({ clientWidth: 320 });
  });

  it("mirrors waveform scroll updates into tier DOM and layout state", () => {
    const { el: tier } = createTierContainer();
    const tierScrollRef = { current: tier };
    const wfApiRef = { current: createWaveformApi(0) };

    const { result } = renderHook(() =>
      useTierScrollSync({
        tierScrollRef,
        timelineWidthPx: 1200,
        wfApiRef: wfApiRef as never,
        waveformReady: true,
        mediaUrl: "/audio.wav",
      }),
    );

    act(() => {
      result.current.syncWaveformScrollPx(144);
    });

    expect(tier.scrollLeft).toBe(144);
    expect(result.current.tierScrollLayout).toEqual({ clientWidth: 320 });
  });

  it("ignores subpixel waveform scroll noise so user scroll doesn't snap back", () => {
    // Regression: WaveSurfer's `zoom` / `setScrollLeft` round to sub-integer
    // positions. The resulting waveform→tier sync event used to write tier
    // back by 0.5-2px, producing visible flicker on long audio. Reverse
    // direction must tolerate noise up to WAVEFORM_SCROLL_REVERSE_SYNC_EPSILON_PX.
    const { el: tier } = createTierContainer();
    const tierScrollRef = { current: tier };
    const wfApiRef = { current: createWaveformApi(0) };

    const { result } = renderHook(() =>
      useTierScrollSync({
        tierScrollRef,
        timelineWidthPx: 2000,
        wfApiRef: wfApiRef as never,
        waveformReady: true,
        mediaUrl: "/audio.wav",
      }),
    );

    // User scrolls to 1000, sync flows through.
    act(() => {
      tier.scrollLeft = 1000;
      result.current.onTierScroll();
    });
    expect(tier.scrollLeft).toBe(1000);

    // WaveSurfer rounds and reports back 998.7 — a 1.3px subpixel delta that
    // used to snap tier back. Must be ignored.
    act(() => {
      result.current.syncWaveformScrollPx(998.7);
    });
    expect(tier.scrollLeft).toBe(1000);

    // A real >4px difference (e.g. playback autoScroll) still propagates.
    act(() => {
      result.current.syncWaveformScrollPx(1010);
    });
    expect(tier.scrollLeft).toBe(1010);
  });

  it("uses smooth DOM scrolling and syncs waveform after scroll settles", () => {
    const { el: tier, scrollToMock } = createTierContainer();
    const tierScrollRef = { current: tier };
    const wfApiRef = { current: createWaveformApi(0) };

    const { result } = renderHook(() =>
      useTierScrollSync({
        tierScrollRef,
        timelineWidthPx: 1200,
        wfApiRef: wfApiRef as never,
        waveformReady: true,
        mediaUrl: "/audio.wav",
      }),
    );

    act(() => {
      result.current.setTierScrollPxSmooth(180);
    });

    expect(scrollToMock).toHaveBeenCalledWith({ left: 180, behavior: "smooth" });
    expect(wfApiRef.current.setScrollLeft).not.toHaveBeenCalled();

    act(() => {
      tier.scrollLeft = 180;
      tier.dispatchEvent(new Event("scrollend"));
    });

    expect(wfApiRef.current.setScrollLeft).toHaveBeenCalledWith(180);
  });
});
