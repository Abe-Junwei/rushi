import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useWaveformTierWheelForward } from "./useWaveformTierWheelForward";

describe("useWaveformTierWheelForward", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls onTierScroll after imperative wheel scroll", () => {
    const tier = document.createElement("div");
    let scrollLeft = 0;
    Object.defineProperty(tier, "scrollLeft", {
      configurable: true,
      get: () => scrollLeft,
      set: (value: number) => {
        scrollLeft = value;
      },
    });
    const shell = document.createElement("div");
    document.body.append(tier, shell);

    const onTierScroll = vi.fn();
    renderHook(() =>
      useWaveformTierWheelForward({
        tierScrollRef: { current: tier },
        waveformShellRef: { current: shell },
        enabled: true,
        onTierScroll,
      }),
    );

    tier.dispatchEvent(new WheelEvent("wheel", { deltaX: 48, bubbles: true }));
    expect(scrollLeft).toBe(48);
    expect(onTierScroll).toHaveBeenCalledTimes(1);

    tier.remove();
    shell.remove();
  });

  it("maps vertical trackpad wheel to tier scroll and sync hook", () => {
    const tier = document.createElement("div");
    let scrollLeft = 0;
    Object.defineProperty(tier, "scrollLeft", {
      configurable: true,
      get: () => scrollLeft,
      set: (value: number) => {
        scrollLeft = value;
      },
    });
    const shell = document.createElement("div");
    document.body.append(tier, shell);

    const onTierScroll = vi.fn();
    renderHook(() =>
      useWaveformTierWheelForward({
        tierScrollRef: { current: tier },
        waveformShellRef: { current: shell },
        enabled: true,
        onTierScroll,
      }),
    );

    shell.dispatchEvent(new WheelEvent("wheel", { deltaY: 64, bubbles: true, cancelable: true }));
    expect(scrollLeft).toBe(64);
    expect(onTierScroll).toHaveBeenCalledTimes(1);

    tier.remove();
    shell.remove();
  });
});
