import { describe, expect, it, vi } from "vitest";
import {
  registerWaveformSegmentBandPaintScheduler,
  requestWaveformSegmentBandPaint,
} from "./waveformSegmentBandPaint";
import { resolveWaveformTierWheelScrollDelta } from "../hooks/useWaveformTierWheelForward";

describe("waveformSegmentBandPaint", () => {
  it("invokes registered paint scheduler on tier scroll mirror", () => {
    const paint = vi.fn();
    const unregister = registerWaveformSegmentBandPaintScheduler(paint);
    requestWaveformSegmentBandPaint();
    expect(paint).toHaveBeenCalledTimes(1);
    unregister();
    requestWaveformSegmentBandPaint();
    expect(paint).toHaveBeenCalledTimes(1);
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
  });
});
