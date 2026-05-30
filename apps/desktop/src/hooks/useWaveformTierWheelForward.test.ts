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
});
