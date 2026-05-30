import { describe, expect, it } from "vitest";
import {
  computeCenterScrollPxForTimeSec,
  computeOverviewPxPerSec,
  computeOverviewViewportRect,
  overviewClientXToTimeSec,
  overviewSegmentBarPx,
} from "./waveformOverviewGeometry";

describe("waveformOverviewGeometry", () => {
  it("computeOverviewViewportRect maps main scroll fraction to overview width", () => {
    const r = computeOverviewViewportRect({
      scrollLeftPx: 500,
      viewportWidthPx: 800,
      timelineWidthPx: 5000,
      overviewWidthPx: 400,
    });
    expect(r.leftPx).toBe(40);
    expect(r.widthPx).toBe(64);
  });

  it("computeOverviewPxPerSec fits duration into overview width", () => {
    expect(computeOverviewPxPerSec(800, 100)).toBe(8);
  });

  it("computeCenterScrollPxForTimeSec centers time in main viewport", () => {
    const sl = computeCenterScrollPxForTimeSec({
      timeSec: 10,
      timelineWidthPx: 5000,
      viewportWidthPx: 800,
      durationSec: 50,
    });
    expect(sl).toBe(10 * 100 - 400);
  });

  it("overviewClientXToTimeSec maps x across strip", () => {
    const t = overviewClientXToTimeSec(150, { left: 100, width: 200 }, 60);
    expect(t).toBeCloseTo(15, 5);
  });

  it("overviewSegmentBarPx maps segment interval to strip pixels", () => {
    const bar = overviewSegmentBarPx(10, 20, 100, 500);
    expect(bar.leftPx).toBe(50);
    expect(bar.widthPx).toBe(50);
  });
});
