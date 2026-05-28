import { describe, expect, it } from "vitest";
import {
  clampPxPerSec,
  clampPxPerSecForSlider,
  computeFitAllPxPerSec,
  computeFitSelectionPxPerSec,
  computeSelectionFitScrollPx,
  computeViewportFitScrollPx,
  PX_PER_SEC_FIT_MIN,
  PX_PER_SEC_MAX,
  PX_PER_SEC_MIN,
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

describe("computeFitAllPxPerSec", () => {
  it("fits a long file into the viewport width", () => {
    expect(computeFitAllPxPerSec(800, 3600)).toBeCloseTo(800 / 3600, 5);
  });

  it("respects timeline min width floor", () => {
    expect(computeFitAllPxPerSec(300, 2)).toBe(160);
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
});

describe("computeViewportFitScrollPx", () => {
  it("returns zero for fit-all", () => {
    expect(
      computeViewportFitScrollPx({
        intent: { kind: "all" },
        viewportWidthPx: 800,
        timelineWidthPx: 800,
        pxPerSec: 56,
      }),
    ).toBe(0);
  });
});
