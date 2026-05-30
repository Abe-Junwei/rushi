import { describe, expect, it } from "vitest";
import { computeTimelineWidthPx } from "./pxPerSec";
import {
  effectiveTimelinePxPerSec,
  playheadTimelineLeftPct,
  scrollPxPreservingViewportCenterTime,
  timeToTimelinePx,
  timelinePxToTime,
  visibleTimeWindowFromScroll,
} from "./waveformProjection";

describe("waveformProjection — single horizontal scale", () => {
  it("aligns overlay and peaks ratio without a width floor", () => {
    const durationSec = 1263;
    const nominalPxPerSec = 0.05;
    const timelineWidthPx = computeTimelineWidthPx(durationSec, nominalPxPerSec);
    expect(timelineWidthPx).toBe(Math.ceil(1263 * 0.05));

    const eff = effectiveTimelinePxPerSec(timelineWidthPx, durationSec);

    for (const t of [0, 120, 631.5, 1262, durationSec]) {
      const overlayPx = t * eff;
      const peaksRatioPx = (Math.min(t, durationSec) / durationSec) * timelineWidthPx;
      expect(overlayPx).toBeCloseTo(peaksRatioPx, 6);
    }
  });

  it("equals the nominal px/s when the floor does NOT engage (common case)", () => {
    const durationSec = 300;
    const nominalPxPerSec = 56;
    const timelineWidthPx = computeTimelineWidthPx(durationSec, nominalPxPerSec);
    const eff = effectiveTimelinePxPerSec(timelineWidthPx, durationSec);
    // ceil rounding only — within 1px/s of nominal.
    expect(eff).toBeGreaterThan(nominalPxPerSec - 0.01);
    expect(eff).toBeLessThan(nominalPxPerSec + 0.01);
  });

  it("timeToTimelinePx / timelinePxToTime round-trip within the timeline", () => {
    const durationSec = 1263;
    const timelineWidthPx = 320;
    for (const t of [0, 200, 1000, durationSec]) {
      const px = timeToTimelinePx(t, timelineWidthPx, durationSec);
      expect(timelinePxToTime(px, timelineWidthPx, durationSec)).toBeCloseTo(t, 4);
    }
  });

  it("clamps out-of-range inputs", () => {
    expect(timeToTimelinePx(-5, 320, 1263)).toBe(0);
    expect(timeToTimelinePx(99999, 320, 1263)).toBe(320);
    expect(timelinePxToTime(-10, 320, 1263)).toBe(0);
    expect(timelinePxToTime(99999, 320, 1263)).toBe(1263);
  });

  it("visibleTimeWindowFromScroll tracks tier scroll", () => {
    const w = visibleTimeWindowFromScroll({
      scrollLeftPx: 160,
      viewportWidthPx: 800,
      timelineWidthPx: 320,
      durationSec: 1263,
    });
    expect(w.start).toBeCloseTo((160 / 320) * 1263, 4);
    expect(w.end).toBe(1263);
  });

  it("playheadTimelineLeftPct matches ratio projection", () => {
    expect(playheadTimelineLeftPct(600, 320, 1263)).toBeCloseTo((600 / 1263) * 100, 4);
    expect(playheadTimelineLeftPct(99999, 320, 10)).toBe(100);
  });

  it("scrollPxPreservingViewportCenterTime keeps the viewport center time on zoom", () => {
    const scroll = scrollPxPreservingViewportCenterTime({
      scrollLeftPx: 400,
      oldTimelineWidthPx: 6720,
      newTimelineWidthPx: 13440,
      durationSec: 120,
      viewportWidthPx: 800,
    });
    expect(scroll).toBe(1200);
    const centerBefore = ((400 + 400) / 6720) * 120;
    const centerAfter = ((scroll + 400) / 13440) * 120;
    expect(centerAfter).toBeCloseTo(centerBefore, 4);
  });
});
