import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useWaveformTierWheelForward } from "./useWaveformTierWheelForward";

function makeScrollableTier(scrollWidth = 10_000, clientWidth = 500): HTMLDivElement {
  const tier = document.createElement("div");
  Object.defineProperty(tier, "scrollWidth", { configurable: true, value: scrollWidth });
  Object.defineProperty(tier, "clientWidth", { configurable: true, value: clientWidth });
  return tier;
}

describe("useWaveformTierWheelForward", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("forwards horizontal wheel deltas to the scroll authority", () => {
    const tier = makeScrollableTier();
    const shell = document.createElement("div");
    document.body.append(tier, shell);

    const onWheelScrollDelta = vi.fn();
    renderHook(() =>
      useWaveformTierWheelForward({
        tierScrollRef: { current: tier },
        waveformShellRef: { current: shell },
        enabled: true,
        onWheelScrollDelta,
        onCancelScrollMotion: vi.fn(),
      }),
    );

    tier.dispatchEvent(new WheelEvent("wheel", { deltaX: 48, bubbles: true, cancelable: true }));

    expect(onWheelScrollDelta).toHaveBeenCalledWith(48);

    tier.remove();
    shell.remove();
  });

  it("maps vertical trackpad wheel to horizontal tier scroll", () => {
    const tier = makeScrollableTier();
    const shell = document.createElement("div");
    document.body.append(tier, shell);

    const onWheelScrollDelta = vi.fn();
    renderHook(() =>
      useWaveformTierWheelForward({
        tierScrollRef: { current: tier },
        waveformShellRef: { current: shell },
        enabled: true,
        onWheelScrollDelta,
        onCancelScrollMotion: vi.fn(),
      }),
    );

    shell.dispatchEvent(new WheelEvent("wheel", { deltaY: 64, bubbles: true, cancelable: true }));

    expect(onWheelScrollDelta).toHaveBeenCalledWith(64);

    tier.remove();
    shell.remove();
  });

  it("does not write tier scroll directly while forwarding", () => {
    const tier = makeScrollableTier();
    const shell = document.createElement("div");
    document.body.append(tier, shell);

    const onWheelScrollDelta = vi.fn();
    renderHook(() =>
      useWaveformTierWheelForward({
        tierScrollRef: { current: tier },
        waveformShellRef: { current: shell },
        enabled: true,
        onWheelScrollDelta,
        onCancelScrollMotion: vi.fn(),
      }),
    );

    shell.dispatchEvent(new WheelEvent("wheel", { deltaY: 64, bubbles: true, cancelable: true }));

    expect(tier.scrollLeft).toBe(0);
    expect(onWheelScrollDelta).toHaveBeenCalledWith(64);

    tier.remove();
    shell.remove();
  });

  it("forwards pointer intent to cancel transient scroll motion", () => {
    const tier = makeScrollableTier();
    const shell = document.createElement("div");
    document.body.append(tier, shell);

    const onCancelScrollMotion = vi.fn();
    renderHook(() =>
      useWaveformTierWheelForward({
        tierScrollRef: { current: tier },
        waveformShellRef: { current: shell },
        enabled: true,
        onWheelScrollDelta: vi.fn(),
        onCancelScrollMotion,
      }),
    );

    shell.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));

    expect(onCancelScrollMotion).toHaveBeenCalledTimes(1);

    tier.remove();
    shell.remove();
  });

  it("caps oversized pixel wheel deltas to avoid jumping across the timeline", () => {
    const tier = makeScrollableTier();
    const shell = document.createElement("div");
    document.body.append(tier, shell);

    const onWheelScrollDelta = vi.fn();
    renderHook(() =>
      useWaveformTierWheelForward({
        tierScrollRef: { current: tier },
        waveformShellRef: { current: shell },
        enabled: true,
        onWheelScrollDelta,
        onCancelScrollMotion: vi.fn(),
      }),
    );

    tier.dispatchEvent(new WheelEvent("wheel", { deltaX: 4000, bubbles: true, cancelable: true }));

    expect(onWheelScrollDelta).toHaveBeenCalledWith(240);

    tier.remove();
    shell.remove();
  });
});
