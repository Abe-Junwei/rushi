import { describe, expect, it } from "vitest";
import {
  computeAlignScrollPxForTimeSec,
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
      pxPerSec: 100,
      timelineWidthPx: 5000,
      viewportWidthPx: 800,
    });
    expect(sl).toBe(10 * 100 - 400);
  });

  it("computeAlignScrollPxForTimeSec aligns time to viewport left edge", () => {
    const sl = computeAlignScrollPxForTimeSec({
      timeSec: 10,
      pxPerSec: 100,
      timelineWidthPx: 5000,
      viewportWidthPx: 800,
    });
    expect(sl).toBe(1000);
  });

  it("overviewClientXToTimeSec maps x across strip", () => {
    const t = overviewClientXToTimeSec(150, { left: 100, width: 200 }, 60);
    expect(t).toBeCloseTo(15, 5);
  });

  it("overviewSegmentBarPx returns bar geometry", () => {
    const b = overviewSegmentBarPx(2, 5, 10);
    expect(b.leftPx).toBe(20);
    expect(b.widthPx).toBe(30);
  });
});
