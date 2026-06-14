import { describe, expect, it } from "vitest";
import {
  capWaveformPeakColumns,
  clampPxPerSec,
  clampPxPerSecForSlider,
  clampPxPerSecForWaveSurferRender,
  computeFitAllPxPerSec,
  computeFitSelectionPxPerSec,
  computeRenderableTimelineWidthPx,
  computeTimelineWidthPx,
  isTimelineFitInViewport,
  resolveMaxPeaksTimelinePxPerSec,
  resolveMaxRenderablePxPerSec,
  resolveSelectionFitPxPerSec,
  resolveViewportFitLayoutPxPerSec,
  resolveDefaultEditingPxPerSec,
  resolveDefaultResetPxPerSec,
  resolveWaveformZoomSliderRange,
  resolveWaveformZoomStepRatio,
  WAVEFORM_ZOOM_STEPS_EACH_WAY,
  computeSelectionFitScrollPx,
  computeViewportFitScrollPx,
  PX_PER_SEC_FIT_MIN,
  PX_PER_SEC_FIT_SELECTION_MAX,
  PX_PER_SEC_MAX,
  PX_PER_SEC_MIN,
  quantizePxPerSecForPeaksLoad,
  shouldZoomOnlyForSubMinFitAllPeaks,
  shouldZoomOnlyForSubMinFitAllRefit,
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

describe("resolveDefaultEditingPxPerSec", () => {
  it("returns geometric mean near 56 px/s for ~2min media", () => {
    const px = resolveDefaultEditingPxPerSec(960, 120);
    expect(px).toBeCloseTo(Math.sqrt(computeFitAllPxPerSec(960, 120) * 400), 4);
    expect(px).toBeCloseTo(56.57, 1);
  });

  it("returns fit-all when min equals max for ultra-short media", () => {
    const fitAll = computeFitAllPxPerSec(800, 0.5);
    expect(resolveDefaultEditingPxPerSec(800, 0.5)).toBeCloseTo(fitAll, 4);
    expect(fitAll).toBeGreaterThan(PX_PER_SEC_MAX);
  });

  it("uses lower default for long media instead of fit-all", () => {
    const dur = 4 * 3600;
    const fitAll = computeFitAllPxPerSec(1200, dur);
    const px = resolveDefaultEditingPxPerSec(1200, dur);
    expect(px).toBeGreaterThan(fitAll);
    expect(px).toBeLessThan(PX_PER_SEC_MAX);
  });

  it("falls back to TIMELINE_PX_PER_SEC without media context", () => {
    expect(resolveDefaultEditingPxPerSec(0, 0)).toBe(TIMELINE_PX_PER_SEC);
  });
});

describe("resolveWaveformZoomStepRatio", () => {
  it("yields 5 symmetric steps from default to min and max", () => {
    const range = resolveWaveformZoomSliderRange(960, 600);
    const ratio = resolveWaveformZoomStepRatio(range);
    const def = resolveDefaultEditingPxPerSec(960, 600);
    let up = def;
    for (let i = 0; i < WAVEFORM_ZOOM_STEPS_EACH_WAY; i++) {
      up *= ratio;
    }
    let down = def;
    for (let i = 0; i < WAVEFORM_ZOOM_STEPS_EACH_WAY; i++) {
      down /= ratio;
    }
    expect(up).toBeCloseTo(range.maxPxPerSec, 2);
    expect(down).toBeCloseTo(range.minPxPerSec, 2);
  });
});

describe("resolveDefaultResetPxPerSec", () => {
  it("matches per-file editing default", () => {
    expect(resolveDefaultResetPxPerSec(800, 120)).toBe(resolveDefaultEditingPxPerSec(800, 120));
  });
});

describe("computeFitSelectionPxPerSec", () => {
  it("uses 80% of viewport width for the segment span", () => {
    expect(computeFitSelectionPxPerSec(800, 10, 12)).toBe((800 * 0.8) / 2);
  });

  it("allows low px/s for long segments", () => {
    const px = computeFitSelectionPxPerSec(800, 0, 120);
    expect(px).toBeCloseTo((800 * 0.8) / 120, 5);
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

describe("resolveViewportFitLayoutPxPerSec", () => {
  it("quantizes then applies WaveSurfer render cap for long media", () => {
    const dur = 3600;
    const raw = computeFitSelectionPxPerSec(800, 10, 12);
    expect(raw).toBeGreaterThan(resolveMaxRenderablePxPerSec(dur));
    const layout = resolveViewportFitLayoutPxPerSec(raw, dur);
    expect(layout).toBeLessThanOrEqual(resolveMaxRenderablePxPerSec(dur));
    expect(layout).toBeLessThanOrEqual(resolveMaxPeaksTimelinePxPerSec(dur));
    expect(computeTimelineWidthPx(dur, layout)).toBeLessThanOrEqual(32_768);
  });
});

describe("shouldZoomOnlyForSubMinFitAllPeaks", () => {
  it("returns true when both loaded and requested px/s are sub-min fit-all", () => {
    expect(shouldZoomOnlyForSubMinFitAllPeaks(0.083, 0.133)).toBe(true);
  });

  it("returns false when loaded peaks were at manual range", () => {
    expect(shouldZoomOnlyForSubMinFitAllPeaks(56, 0.133)).toBe(false);
  });
});

describe("shouldZoomOnlyForSubMinFitAllRefit", () => {
  it("allows first peaks load on decode when fit-all changes px/s from manual range", () => {
    expect(
      shouldZoomOnlyForSubMinFitAllRefit({
        requestedPeaksPxPerSec: 0.96,
        loadedPeaksPxPerSec: Number.NaN,
        peaksLoadedIntoWaveSurfer: false,
        peaksLoadInFlight: false,
      }),
    ).toBe(false);
  });

  it("zoom-only after sub-min peaks are loaded and viewport refits px/s", () => {
    expect(
      shouldZoomOnlyForSubMinFitAllRefit({
        requestedPeaksPxPerSec: 0.133,
        loadedPeaksPxPerSec: 0.083,
        peaksLoadedIntoWaveSurfer: true,
        peaksLoadInFlight: false,
      }),
    ).toBe(true);
  });

  it("allows initial peaks load when px/s unchanged on mount", () => {
    expect(
      shouldZoomOnlyForSubMinFitAllRefit({
        requestedPeaksPxPerSec: 0.083,
        loadedPeaksPxPerSec: Number.NaN,
        peaksLoadedIntoWaveSurfer: false,
        peaksLoadInFlight: false,
      }),
    ).toBe(false);
  });

  it("zoom-only while sub-min peaks load is in flight", () => {
    expect(
      shouldZoomOnlyForSubMinFitAllRefit({
        requestedPeaksPxPerSec: 0.133,
        loadedPeaksPxPerSec: Number.NaN,
        peaksLoadedIntoWaveSurfer: false,
        peaksLoadInFlight: true,
      }),
    ).toBe(true);
  });
});

describe("resolveSelectionFitPxPerSec", () => {
  it("keeps current px/s when segment already fits in viewport", () => {
    const px = resolveSelectionFitPxPerSec(800, 10, 12, 120);
    expect(px).toBe(120);
  });

  it("zooms out when segment is wider than viewport at current px/s", () => {
    const px = resolveSelectionFitPxPerSec(800, 0, 60, 120);
    expect(px).toBe(quantizePxPerSecForPeaksLoad((800 * 0.8) / 60));
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
    const tw = Math.ceil(dur * px);
    const scroll = computeSelectionFitScrollPx({
      viewportWidthPx: 800,
      timelineWidthPx: tw,
      durationSec: dur,
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
        startSec: 0,
        endSec: 1,
      }),
    ).toBe(0);
  });

  it("clamps scroll at timeline end for last segment", () => {
    const px = 56;
    const dur = 60;
    const tw = Math.ceil(dur * px);
    const vw = 800;
    const scroll = computeSelectionFitScrollPx({
      viewportWidthPx: vw,
      timelineWidthPx: tw,
      durationSec: dur,
      startSec: 58,
      endSec: 60,
    });
    expect(scroll).toBe(Math.max(0, tw - vw));
  });

  it("uses timeline width proportion for scroll", () => {
    const dur = 10;
    const tw = Math.ceil(dur * 56);
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
      }),
    ).toBe(
      computeSelectionFitScrollPx({
        viewportWidthPx: 800,
        timelineWidthPx: 6720,
        durationSec: 120,
        startSec: 10,
        endSec: 12,
      }),
    );
  });
});

describe("capWaveformPeakColumns", () => {
  it("caps 4h audio at high zoom to a fixed column budget", () => {
    const timelineWidth = computeTimelineWidthPx(14_400, 107);
    expect(timelineWidth).toBeGreaterThan(1_000_000);
    expect(capWaveformPeakColumns(timelineWidth)).toBe(32_768);
  });
});

describe("resolveMaxPeaksTimelinePxPerSec", () => {
  it("limits px/s so duration×px/s stays within peaks column budget", () => {
    expect(resolveMaxPeaksTimelinePxPerSec(360)).toBeCloseTo(32_768 / 360, 4);
    expect(clampPxPerSecForWaveSurferRender(100, 360)).toBeLessThanOrEqual(32_768 / 360 + 1e-6);
  });
});

describe("computeRenderableTimelineWidthPx", () => {
  it("regression: 360s @ 100px/s must not exceed peaks column cap (DMG peaks path)", () => {
    const width = computeRenderableTimelineWidthPx(360, 100);
    expect(width).toBeLessThanOrEqual(32_768);
    expect(width).toBe(Math.ceil(360 * clampPxPerSecForWaveSurferRender(100, 360)));
  });
});

describe("resolveMaxRenderablePxPerSec", () => {
  it("limits decode canvas width for very long media", () => {
    const maxPx = resolveMaxRenderablePxPerSec(14_400);
    expect(maxPx).toBeCloseTo(262_144 / 14_400, 4);
    expect(clampPxPerSecForWaveSurferRender(107, 14_400)).toBeLessThan(20);
  });
});
