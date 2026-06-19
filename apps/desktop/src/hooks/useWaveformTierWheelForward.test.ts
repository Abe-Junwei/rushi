import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useWaveformTierWheelForward } from "./useWaveformTierWheelForward";

function makeScrollableTier(scrollWidth = 10_000, clientWidth = 500): HTMLDivElement {
  const tier = document.createElement("div");
  let scrollLeft = 0;
  Object.defineProperty(tier, "scrollLeft", {
    configurable: true,
    get: () => scrollLeft,
    set: (value: number) => {
      scrollLeft = value;
    },
  });
  Object.defineProperty(tier, "scrollWidth", { configurable: true, value: scrollWidth });
  Object.defineProperty(tier, "clientWidth", { configurable: true, value: clientWidth });
  return tier;
}

function installControllableRaf(): { flushUntilSettled: (read: () => number, target: number) => void } {
  const callbacks: FrameRequestCallback[] = [];
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    callbacks.push(cb);
    return callbacks.length;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});
  const flushUntilSettled = (read: () => number, target: number) => {
    for (let i = 0; i < 80 && read() !== target; i += 1) {
      const pending = callbacks.splice(0);
      if (pending.length === 0) break;
      pending.forEach((cb) => cb(0));
    }
  };
  return { flushUntilSettled };
}

describe("useWaveformTierWheelForward", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("eases tier scroll toward the accumulated wheel target and notifies sync", () => {
    const { flushUntilSettled } = installControllableRaf();
    const tier = makeScrollableTier();
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

    tier.dispatchEvent(new WheelEvent("wheel", { deltaX: 48, bubbles: true, cancelable: true }));
    flushUntilSettled(() => tier.scrollLeft, 120);

    expect(tier.scrollLeft).toBe(120);
    expect(onTierScroll).toHaveBeenCalled();

    tier.remove();
    shell.remove();
  });

  it("maps vertical trackpad wheel to horizontal tier scroll", () => {
    const { flushUntilSettled } = installControllableRaf();
    const tier = makeScrollableTier();
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
    flushUntilSettled(() => tier.scrollLeft, 160);

    expect(tier.scrollLeft).toBe(160);
    expect(onTierScroll).toHaveBeenCalled();

    tier.remove();
    shell.remove();
  });

  it("clamps the wheel target to the scrollable range", () => {
    const { flushUntilSettled } = installControllableRaf();
    const tier = makeScrollableTier(700, 500);
    const shell = document.createElement("div");
    document.body.append(tier, shell);

    renderHook(() =>
      useWaveformTierWheelForward({
        tierScrollRef: { current: tier },
        waveformShellRef: { current: shell },
        enabled: true,
        onTierScroll: vi.fn(),
      }),
    );

    tier.dispatchEvent(new WheelEvent("wheel", { deltaX: 4000, bubbles: true, cancelable: true }));
    flushUntilSettled(() => tier.scrollLeft, 200);

    expect(tier.scrollLeft).toBe(200);

    tier.remove();
    shell.remove();
  });
});
