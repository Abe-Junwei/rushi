import { describe, expect, it } from "vitest";
import {
  buildVisibleRulerTicks,
  computeEmbeddedRulerLabelStride,
  findHighlightedRulerMajorTickTime,
  pickRulerTickSteps,
} from "./waveformRulerTicks";

describe("waveformRulerTicks", () => {
  it("pickRulerTickSteps chooses readable major/minor spacing", () => {
    expect(pickRulerTickSteps(56).majorStep).toBe(5);
    expect(pickRulerTickSteps(0.2).majorStep).toBeGreaterThanOrEqual(60);
  });

  it("buildVisibleRulerTicks marks major ticks on step boundaries", () => {
    const { ticks, majorStep } = buildVisibleRulerTicks({
      durationSec: 120,
      tickPxPerSec: 56,
      visibleStart: 0,
      visibleEnd: 30,
    });
    expect(majorStep).toBe(5);
    expect(ticks.some((t) => t.major && t.t === 0)).toBe(true);
    expect(ticks.some((t) => t.major && t.t === 10)).toBe(true);
  });

  it("computeEmbeddedRulerLabelStride widens labels when majors are dense", () => {
    expect(computeEmbeddedRulerLabelStride(true, 1, 40)).toBe(3);
    expect(computeEmbeddedRulerLabelStride(false, 1, 40)).toBe(1);
  });

  it("findHighlightedRulerMajorTickTime snaps near playhead", () => {
    const majors = [{ t: 10, major: true }, { t: 20, major: true }];
    expect(findHighlightedRulerMajorTickTime(majors, 10.2, 10)).toBe(10);
    expect(findHighlightedRulerMajorTickTime(majors, 50, 10)).toBeNull();
  });
});
