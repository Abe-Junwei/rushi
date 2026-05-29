import { describe, expect, it } from "vitest";
import {
  computeFitAllPxPerSec,
  computeFitSelectionPxPerSec,
  PX_PER_SEC_MAX,
  resolveWaveformZoomSliderRange,
  TIMELINE_PX_PER_SEC,
} from "./pxPerSec";
import { computeWaveformZoomBarUiState } from "./waveformZoomBarState";

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
});
