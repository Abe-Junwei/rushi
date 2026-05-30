import { describe, expect, it } from "vitest";
import {
  computeFitAllPxPerSec,
  computeFitSelectionPxPerSec,
  PX_PER_SEC_MAX,
  resolveWaveformZoomSliderRange,
  TIMELINE_PX_PER_SEC,
} from "./pxPerSec";
import { computeWaveformZoomBarUiState, resolveFitAllPxPerSecAdjustment } from "./waveformZoomBarState";

describe("computeWaveformZoomBarUiState", () => {
  it("marks default zoom at 56 px/s", () => {
    const s = computeWaveformZoomBarUiState(TIMELINE_PX_PER_SEC);
    expect(s.viewMode).toBe("default");
    expect(s.atDefaultZoom).toBe(true);
    expect(s.zoomPercentLabel).toBe(100);
  });

  it("marks min at fit-all and max at slider ceiling", () => {
    const fitAll = computeFitAllPxPerSec(800, 3600);
    const s = computeWaveformZoomBarUiState({
      pxPerSec: fitAll,
      viewportWidthPx: 800,
      durationSec: 3600,
      layoutIntent: "fit-all",
    });
    expect(s.atMinZoom).toBe(true);
    expect(s.atFitAllZoom).toBe(true);
    expect(computeWaveformZoomBarUiState(PX_PER_SEC_MAX).atMaxZoom).toBe(true);
  });

  it("marks fit-selection view when px matches selected segment fit", () => {
    const fitSelPx = computeFitSelectionPxPerSec(800, 10, 20);
    const s = computeWaveformZoomBarUiState({
      pxPerSec: fitSelPx,
      viewportWidthPx: 800,
      durationSec: 120,
      selectedStartSec: 10,
      selectedEndSec: 20,
    });
    expect(s.viewMode).toBe("fit-selection");
    expect(s.atFitSelectionZoom).toBe(true);
  });

  it("ultra-low px/s below file fit-all is below slider range", () => {
    const s = computeWaveformZoomBarUiState({
      pxPerSec: 0.05,
      viewportWidthPx: 800,
      durationSec: 3600,
    });
    expect(s.viewMode).toBe("custom");
    expect(s.belowManualSliderRange).toBe(true);
    expect(s.atMinZoom).toBe(false);
  });

  it("does not mark near-fit-all px/s as below slider min (long media, wide viewport)", () => {
    const fitAll = computeFitAllPxPerSec(1200, 1195);
    const s = computeWaveformZoomBarUiState({
      pxPerSec: 1,
      viewportWidthPx: 1200,
      durationSec: 1195,
      sliderRange: resolveWaveformZoomSliderRange(1200, 1195),
    });
    expect(fitAll).toBeGreaterThan(1);
    expect(s.belowManualSliderRange).toBe(false);
    expect(s.atMinZoom).toBe(true);
  });

  it("does not mark zoomed-out below fit-all as atFitAllZoom without intent", () => {
    const dur = 3600;
    const vw = 800;
    const fitAll = computeFitAllPxPerSec(vw, dur);
    const s = computeWaveformZoomBarUiState({
      pxPerSec: fitAll * 0.5,
      viewportWidthPx: vw,
      durationSec: dur,
    });
    expect(s.atFitAllZoom).toBe(false);
  });

  it("marks fit-all intent even before fill converges", () => {
    const dur = 3 * 3600 + 40 * 60;
    const vw = 1200;
    const stalePx = computeFitAllPxPerSec(960, dur);
    const s = computeWaveformZoomBarUiState({
      pxPerSec: stalePx,
      viewportWidthPx: vw,
      durationSec: dur,
      layoutIntent: "fit-all",
    });
    expect(s.atFitAllZoom).toBe(true);
  });
});

describe("resolveFitAllPxPerSecAdjustment", () => {
  it("raises px/s when viewport grew but fit-all px/s stayed on the old width", () => {
    const dur = 4 * 3600 + 29;
    const oldVw = 1200;
    const newVw = 1600;
    const staleFitAll = computeFitAllPxPerSec(oldVw, dur);
    const next = resolveFitAllPxPerSecAdjustment(newVw, dur, staleFitAll, {
      staleFitAllOnViewportGrow: true,
    });
    expect(next).not.toBeNull();
    expect(next!).toBeCloseTo(computeFitAllPxPerSec(newVw, dur), 6);
  });

  it("refits after a large fullscreen grow from prior fit-all width", () => {
    const dur = 4 * 3600 + 29;
    const staleFitAll = computeFitAllPxPerSec(1200, dur);
    const next = resolveFitAllPxPerSecAdjustment(1920, dur, staleFitAll, {
      staleFitAllOnViewportGrow: true,
    });
    expect(next).toBeCloseTo(computeFitAllPxPerSec(1920, dur), 6);
  });

  it("does not refit when the user zoomed out below fit-all", () => {
    const dur = 3600;
    const vw = 800;
    const fitAll = computeFitAllPxPerSec(vw, dur);
    expect(resolveFitAllPxPerSecAdjustment(vw, dur, fitAll * 0.5)).toBeNull();
  });

  it("does not snap manual zoom in 55-100% fit-all band without layout intent", () => {
    const dur = 3600;
    const oldVw = 800;
    const newVw = 1200;
    const fitAllOld = computeFitAllPxPerSec(oldVw, dur);
    const manualPx = fitAllOld * 0.7;
    expect(resolveFitAllPxPerSecAdjustment(newVw, dur, manualPx)).toBeNull();
  });

  it("refits when timeline fits in viewport but leaves a fill gap (fit-all stale width)", () => {
    const dur = 3 * 3600 + 40 * 60 + 29;
    const vw = 1200;
    const stalePx = computeFitAllPxPerSec(960, dur);
    const next = resolveFitAllPxPerSecAdjustment(vw, dur, stalePx, {
      staleFitAllOnViewportGrow: true,
    });
    expect(next).toBeCloseTo(computeFitAllPxPerSec(vw, dur), 6);
  });

  it("refits under fit-all intent when viewport unchanged but fill gap remains", () => {
    const dur = 3 * 3600 + 40 * 60;
    const vw = 1200;
    const stalePx = computeFitAllPxPerSec(960, dur);
    const next = resolveFitAllPxPerSecAdjustment(vw, dur, stalePx, {
      layoutIntent: "fit-all",
    });
    expect(next).toBeCloseTo(computeFitAllPxPerSec(vw, dur), 6);
  });
});
