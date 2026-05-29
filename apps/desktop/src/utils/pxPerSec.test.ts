import { describe, expect, it } from "vitest";
import {
  clampPxPerSec,
  clampPxPerSecForSlider,
  computeFitAllPxPerSec,
  computeFitSelectionPxPerSec,
  isTimelineFitInViewport,
  resolveSelectionFitPxPerSec,
  resolveDefaultResetPxPerSec,
  resolveWaveformZoomSliderRange,
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

describe("computeFitAllPxPerSec", () => {
  it("fits timeline width to viewport for long media", () => {
    const px = computeFitAllPxPerSec(800, 3600);
    expect(px).toBeCloseTo(800 / 3600, 5);
    expect(isTimelineFitInViewport(800, 3600, px)).toBe(true);
  });

  it("slider min is below legacy 16 px/s for hour-long audio", () => {
    const px = computeFitAllPxPerSec(800, 3600);
    expect(px).toBeLessThan(PX_PER_SEC_MIN);
    expect(Math.round((px / 56) * 100)).toBeLessThan(29);
  });
});

describe("resolveWaveformZoomSliderRange", () => {
  it("uses fit-all as min and caps max above min", () => {
    const range = resolveWaveformZoomSliderRange(800, 120);
    expect(range.minPxPerSec).toBeCloseTo((800 - 0) / 120, 4);
    expect(range.maxPxPerSec).toBeGreaterThan(range.minPxPerSec);
  });

  it("raises min above manual max for short media", () => {
    const range = resolveWaveformZoomSliderRange(800, 0.5);
    expect(range.minPxPerSec).toBeGreaterThan(PX_PER_SEC_MAX);
    expect(range.maxPxPerSec).toBeGreaterThanOrEqual(range.minPxPerSec);
  });
});

describe("resolveDefaultResetPxPerSec", () => {
  it("returns fit-all for short media where fit-all exceeds manual max", () => {
    const fitAll = computeFitAllPxPerSec(800, 0.5);
    expect(resolveDefaultResetPxPerSec(800, 0.5)).toBe(fitAll);
    expect(fitAll).toBeGreaterThan(PX_PER_SEC_MAX);
  });

  it("returns design default for long media", () => {
    expect(resolveDefaultResetPxPerSec(800, 120)).toBe(TIMELINE_PX_PER_SEC);
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
    expect(q).toBe(0.2);
  });

  it("preserves sub-manual fit-all px/s instead of collapsing to fit min", () => {
    const fitAll = computeFitAllPxPerSec(800, 3600);
    expect(fitAll).toBeLessThan(PX_PER_SEC_MIN);
    expect(quantizePxPerSecForPeaksLoad(fitAll)).toBeCloseTo(fitAll, 5);
  });

  it("allows fit-selection zoom above the manual slider ceiling", () => {
    const q = quantizePxPerSecForPeaksLoad(1000);
    expect(q).toBeGreaterThan(PX_PER_SEC_MAX);
    expect(q).toBeLessThanOrEqual(PX_PER_SEC_FIT_SELECTION_MAX);
  });

  it("caps fit-selection zoom at the fit-selection max", () => {
    expect(quantizePxPerSecForPeaksLoad(5000)).toBe(PX_PER_SEC_FIT_SELECTION_MAX);
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
    const dur = 50;
    const tw = Math.max(Math.ceil(dur * px), 320);
    const scroll = computeSelectionFitScrollPx({
      viewportWidthPx: 800,
      timelineWidthPx: tw,
      durationSec: dur,
      pxPerSec: px,
      startSec: 10,
      endSec: 12,
    });
    expect(scroll).toBe((10 / dur) * tw - (800 - (2 / dur) * tw) / 2);
  });

  it("clamps scroll at timeline start for first segment", () => {
    expect(
      computeSelectionFitScrollPx({
        viewportWidthPx: 800,
        timelineWidthPx: 5000,
        durationSec: 60,
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
      durationSec: dur,
      pxPerSec: px,
      startSec: 58,
      endSec: 60,
    });
    expect(scroll).toBe(Math.max(0, tw - vw));
  });

  it("uses timeline width proportion when floor widens content", () => {
    const dur = 10;
    const tw = 320;
    const scroll = computeSelectionFitScrollPx({
      viewportWidthPx: 800,
      timelineWidthPx: tw,
      durationSec: dur,
      startSec: 5,
      endSec: 7,
    });
    const segStartPx = (5 / dur) * tw;
    const segWidthPx = (2 / dur) * tw;
    expect(scroll).toBe(Math.max(0, segStartPx - (800 - segWidthPx) / 2));
  });
});

describe("computeViewportFitScrollPx", () => {
  it("delegates to selection scroll", () => {
    expect(
      computeViewportFitScrollPx({
        intent: { startSec: 10, endSec: 12 },
        viewportWidthPx: 800,
        timelineWidthPx: 6720,
        durationSec: 120,
        pxPerSec: 56,
      }),
    ).toBe(
      computeSelectionFitScrollPx({
        viewportWidthPx: 800,
        timelineWidthPx: 6720,
        durationSec: 120,
        pxPerSec: 56,
        startSec: 10,
        endSec: 12,
      }),
    );
  });
});
