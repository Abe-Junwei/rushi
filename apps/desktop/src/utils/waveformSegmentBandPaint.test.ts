import { describe, expect, it, vi } from "vitest";
import {
  flushTierScrollFrameForTests,
  requestWaveformSegmentBandPaint,
  resetTierScrollFrameCoordinatorForTests,
  subscribeTierScrollFrame,
} from "./waveformSegmentBandPaint";
import { resolveWaveformTierWheelScrollDelta } from "../hooks/useWaveformTierWheelForward";

describe("waveformSegmentBandPaint", () => {
  it("invokes registered paint scheduler on tier scroll mirror", () => {
    vi.stubGlobal("requestAnimationFrame", () => 99);
    const paint = vi.fn();
    const unregister = subscribeTierScrollFrame(paint);
    requestWaveformSegmentBandPaint();
    expect(paint).not.toHaveBeenCalled();
    flushTierScrollFrameForTests();
    expect(paint).toHaveBeenCalledTimes(1);
    unregister();
    resetTierScrollFrameCoordinatorForTests();
    requestWaveformSegmentBandPaint();
    flushTierScrollFrameForTests();
    expect(paint).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});

describe("resolveWaveformTierWheelScrollDelta", () => {
  it("maps dominant vertical trackpad delta to horizontal tier scroll", () => {
    expect(
      resolveWaveformTierWheelScrollDelta({ deltaX: 0, deltaY: 32 } as WheelEvent),
    ).toBe(32);
    expect(
      resolveWaveformTierWheelScrollDelta({ deltaX: 48, deltaY: 8 } as WheelEvent),
    ).toBe(48);
    expect(
      resolveWaveformTierWheelScrollDelta({ deltaX: 4000, deltaY: 0 } as WheelEvent),
    ).toBe(240);
  });
});
