import { describe, expect, it } from "vitest";
import {
  clampPxPerSec,
  clampPxPerSecForSlider,
  computeFitSelectionPxPerSec,
  resolveSelectionFitPxPerSec,
  computeSelectionFitScrollPx,
  computeViewportFitScrollPx,
  PX_PER_SEC_FIT_MIN,
  PX_PER_SEC_FIT_SELECTION_MAX,
  PX_PER_SEC_MAX,
  PX_PER_SEC_MIN,
  quantizePxPerSecForPeaksLoad,
  TIMELINE_PX_PER_SEC,
} from "./pxPerSec";

describe("clampPxPerSec", () => {
  it("clamps to fit min/max", () => {
    expect(clampPxPerSec(0.01)).toBe(PX_PER_SEC_FIT_MIN);
    expect(clampPxPerSec(9999)).toBe(PX_PER_SEC_MAX);
  });

  it("returns default for non-finite", () => {
    expect(clampPxPerSec(Number.NaN)).toBe(TIMELINE_PX_PER_SEC);
  });

  it("passes through in-range values including fit-only low zoom", () => {
    expect(clampPxPerSec(56)).toBe(56);
    expect(clampPxPerSec(120)).toBe(120);
    expect(clampPxPerSec(0.2)).toBe(0.2);
  });
});

describe("clampPxPerSecForSlider", () => {
  it("clamps to manual slider min/max", () => {
    expect(clampPxPerSecForSlider(1)).toBe(PX_PER_SEC_MIN);
    expect(clampPxPerSecForSlider(0.2)).toBe(PX_PER_SEC_MIN);
    expect(clampPxPerSecForSlider(9999)).toBe(PX_PER_SEC_MAX);
  });
});

describe("computeFitSelectionPxPerSec", () => {
  it("uses viewport width minus horizontal padding", () => {
    expect(computeFitSelectionPxPerSec(800, 10, 12)).toBe((800 - 24) / 2);
  });

  it("allows low px/s for long segments", () => {
    const px = computeFitSelectionPxPerSec(800, 0, 120);
    expect(px).toBeCloseTo((800 - 24) / 120, 5);
    expect(px).toBeLessThan(PX_PER_SEC_MIN);
  });

  it("exceeds manual slider max for very short segments", () => {
    const px = computeFitSelectionPxPerSec(800, 10, 10.02);
    expect(px).toBeGreaterThan(PX_PER_SEC_MAX);
    expect(px).toBeLessThanOrEqual(PX_PER_SEC_FIT_SELECTION_MAX);
  });
});

describe("quantizePxPerSecForPeaksLoad", () => {
  it("snaps to 8 px/s steps in manual range", () => {
    expect(quantizePxPerSecForPeaksLoad(57)).toBe(56);
    expect(quantizePxPerSecForPeaksLoad(60)).toBe(64);
  });

  it("respects fit min below manual slider", () => {
    const q = quantizePxPerSecForPeaksLoad(0.2);
    expect(q).toBe(PX_PER_SEC_FIT_MIN);
  });
});

describe("resolveSelectionFitPxPerSec", () => {
  it("keeps current px/s when segment already fits in viewport", () => {
    const px = resolveSelectionFitPxPerSec(800, 10, 12, 120);
    expect(px).toBe(120);
  });

  it("zooms out when segment is wider than viewport at current px/s", () => {
    const px = resolveSelectionFitPxPerSec(800, 0, 60, 120);
    expect(px).toBe(quantizePxPerSecForPeaksLoad((800 - 24) / 60));
    expect(px).toBeLessThan(120);
  });

  it("force-full-fit equivalent uses ideal px when segment is narrow at default zoom", () => {
    const ideal = computeFitSelectionPxPerSec(800, 10, 10.5);
    expect(ideal).toBeGreaterThan(56);
    expect(resolveSelectionFitPxPerSec(800, 10, 10.5, 56)).toBe(56);
  });
});

describe("computeSelectionFitScrollPx", () => {
  it("centers the segment in the viewport", () => {
    const px = 100;
    const scroll = computeSelectionFitScrollPx({
      viewportWidthPx: 800,
      timelineWidthPx: 5000,
      pxPerSec: px,
      startSec: 10,
      endSec: 12,
    });
    expect(scroll).toBe(10 * px - (800 - 2 * px) / 2);
  });

  it("clamps scroll at timeline start for first segment", () => {
    expect(
      computeSelectionFitScrollPx({
        viewportWidthPx: 800,
        timelineWidthPx: 5000,
        pxPerSec: 56,
        startSec: 0,
        endSec: 1,
      }),
    ).toBe(0);
  });

  it("clamps scroll at timeline end for last segment", () => {
    const px = 56;
    const dur = 60;
    const tw = Math.max(Math.ceil(dur * px), 320);
    const vw = 800;
    const scroll = computeSelectionFitScrollPx({
      viewportWidthPx: vw,
      timelineWidthPx: tw,
      pxPerSec: px,
      startSec: 58,
      endSec: 60,
    });
    expect(scroll).toBe(Math.max(0, tw - vw));
  });
});

describe("computeViewportFitScrollPx", () => {
  it("delegates to selection scroll", () => {
    expect(
      computeViewportFitScrollPx({
        intent: { startSec: 10, endSec: 12 },
        viewportWidthPx: 800,
        timelineWidthPx: 6720,
        pxPerSec: 56,
      }),
    ).toBe(
      computeSelectionFitScrollPx({
        viewportWidthPx: 800,
        timelineWidthPx: 6720,
        pxPerSec: 56,
        startSec: 10,
        endSec: 12,
      }),
    );
  });
});
