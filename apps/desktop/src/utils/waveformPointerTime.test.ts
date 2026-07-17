import { afterEach, describe, expect, it } from "vitest";
import { timelinePxToTime } from "./waveformProjection";
import {
  clientXToTimelinePx,
  clientXToTimeSecInTierScroll,
  resolveWaveformPointerTimeSecFromClientX,
} from "./waveformPointerTime";
import {
  clearTierViewportMetricsDuringScrollFrameForTests,
  setPlaybackFractionalPx,
  writeTierViewportMetricsDuringScrollFrame,
} from "./tierScrollFrameCoordinator";

describe("waveformPointerTime", () => {
  afterEach(() => {
    clearTierViewportMetricsDuringScrollFrameForTests();
    setPlaybackFractionalPx(0);
  });

  it("clientXToTimelinePx subtracts container left", () => {
    expect(clientXToTimelinePx(180, 100)).toBe(80);
  });

  it("clientXToTimeSecInTierScroll accounts for tier scrollLeft", () => {
    const sec = clientXToTimeSecInTierScroll({
      clientX: 200,
      tierViewportLeftPx: 100,
      tierScrollLeftPx: 500,
      timelineWidthPx: 5600,
      durationSec: 60,
    });
    expect(sec).toBeCloseTo(timelinePxToTime(600, 5600, 60), 5);
  });

  it("resolveWaveformPointerTimeSecFromClientX prefers scroll-frame snapshot", () => {
    const tier = document.createElement("div");
    Object.defineProperty(tier, "scrollLeft", { configurable: true, value: 0 });
    Object.defineProperty(tier, "clientWidth", { configurable: true, value: 500 });
    Object.defineProperty(tier, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ left: 100, top: 0, width: 500, height: 80, right: 600, bottom: 80 }),
    });

    writeTierViewportMetricsDuringScrollFrame({ scrollLeftPx: 1200, viewportWidthPx: 500 });
    setPlaybackFractionalPx(0);

    const sec = resolveWaveformPointerTimeSecFromClientX({
      clientX: 200,
      tierScrollEl: tier,
      timelineWidthPx: 5600,
      durationSec: 60,
    });

    expect(sec).toBeCloseTo(timelinePxToTime(1300, 5600, 60), 5);
  });

  it("resolveWaveformPointerTimeSecFromClientX includes playback fractional px", () => {
    const tier = document.createElement("div");
    Object.defineProperty(tier, "scrollLeft", { configurable: true, value: 0 });
    Object.defineProperty(tier, "clientWidth", { configurable: true, value: 500 });
    Object.defineProperty(tier, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ left: 100, top: 0, width: 500, height: 80, right: 600, bottom: 80 }),
    });

    writeTierViewportMetricsDuringScrollFrame({ scrollLeftPx: 1200, viewportWidthPx: 500 });
    setPlaybackFractionalPx(40);

    const sec = resolveWaveformPointerTimeSecFromClientX({
      clientX: 200,
      tierScrollEl: tier,
      timelineWidthPx: 5600,
      durationSec: 60,
    });

    expect(sec).toBeCloseTo(timelinePxToTime(1340, 5600, 60), 5);
  });

  it("timeline projection inverts time from timeline px", () => {
    expect(timelinePxToTime(80, 560, 60)).toBeCloseTo(8.571, 2);
    expect(timelinePxToTime(99999, 320, 10)).toBe(10);
    expect(timelinePxToTime(-5, 320, 10)).toBe(0);
  });
});
