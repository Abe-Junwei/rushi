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
    expect(result.current.tierScrollLayout).toEqual({ scrollLeft: 96, clientWidth: 320 });
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
    expect(result.current.tierScrollLayout).toEqual({ scrollLeft: 144, clientWidth: 320 });
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
