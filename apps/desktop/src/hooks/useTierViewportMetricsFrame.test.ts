import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useTierViewportMetricsFrame } from "./useTierViewportMetricsFrame";

describe("useTierViewportMetricsFrame", () => {
  it("re-reads scrollLeft after tier scroll events", () => {
    const tier = document.createElement("div");
    Object.defineProperty(tier, "clientWidth", { value: 400, configurable: true });
    tier.scrollLeft = 0;
    document.body.appendChild(tier);

    const tierScrollRef = { current: tier };
    const tierScrollLive = {
      scrollLeftRef: { current: 0 },
      clientWidthRef: { current: 400 },
    };

    const { result } = renderHook(() =>
      useTierViewportMetricsFrame({
        tierScrollRef,
        tierScrollLive,
        tierScrollLayout: { scrollLeftPx: 0, clientWidthPx: 400 },
      }),
    );

    expect(result.current.scrollLeftPx).toBe(0);

    act(() => {
      tier.scrollLeft = 120;
      tierScrollLive.scrollLeftRef.current = 120;
      tier.dispatchEvent(new Event("scroll"));
    });

    expect(result.current.scrollLeftPx).toBe(120);

    act(() => {
      tier.scrollLeft = 480;
      tierScrollLive.scrollLeftRef.current = 120;
      tier.dispatchEvent(new Event("scroll"));
    });

    expect(result.current.scrollLeftPx).toBe(480);

    tier.remove();
  });

  it("does not re-render on scroll when commitScrollFrame is false", () => {
    const tier = document.createElement("div");
    Object.defineProperty(tier, "clientWidth", { value: 400, configurable: true });
    tier.scrollLeft = 0;
    document.body.appendChild(tier);

    const tierScrollRef = { current: tier };
    const tierScrollLive = {
      scrollLeftRef: { current: 0 },
      clientWidthRef: { current: 400 },
    };

    let renderCount = 0;
    const { result } = renderHook(() => {
      renderCount += 1;
      return useTierViewportMetricsFrame({
        tierScrollRef,
        tierScrollLive,
        tierScrollLayout: { scrollLeftPx: 0, clientWidthPx: 400 },
        commitScrollFrame: false,
      });
    });

    const rendersAfterMount = renderCount;

    act(() => {
      tier.scrollLeft = 120;
      tier.dispatchEvent(new Event("scroll"));
    });

    expect(renderCount).toBe(rendersAfterMount);
    expect(tierScrollLive.scrollLeftRef.current).toBe(120);
    expect(result.current.scrollLeftPx).toBe(0);

    tier.remove();
  });

  it("re-reads scrollLeft after tier wheel events", () => {
    const tier = document.createElement("div");
    Object.defineProperty(tier, "clientWidth", { value: 400, configurable: true });
    Object.defineProperty(tier, "scrollLeft", { value: 0, configurable: true, writable: true });
    document.body.appendChild(tier);

    const tierScrollRef = { current: tier };
    const tierScrollLive = {
      scrollLeftRef: { current: 0 },
      clientWidthRef: { current: 400 },
    };

    const { result } = renderHook(() =>
      useTierViewportMetricsFrame({
        tierScrollRef,
        tierScrollLive,
        tierScrollLayout: { scrollLeftPx: 0, clientWidthPx: 400 },
      }),
    );

    act(() => {
      tier.scrollLeft = 200;
      tier.dispatchEvent(new WheelEvent("wheel", { deltaX: 1, bubbles: true }));
    });

    expect(result.current.scrollLeftPx).toBe(200);

    tier.remove();
  });
});
