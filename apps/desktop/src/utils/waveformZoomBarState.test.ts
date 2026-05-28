import { describe, expect, it } from "vitest";
import {
  computeFitSelectionPxPerSec,
  PX_PER_SEC_MAX,
  PX_PER_SEC_MIN,
  TIMELINE_PX_PER_SEC,
} from "./pxPerSec";
import { computeCrosshairTogglePressed, computeWaveformZoomBarUiState } from "./waveformZoomBarState";

describe("computeWaveformZoomBarUiState", () => {
  it("marks default zoom at 56 px/s", () => {
    const s = computeWaveformZoomBarUiState(TIMELINE_PX_PER_SEC);
    expect(s.viewMode).toBe("default");
    expect(s.atDefaultZoom).toBe(true);
    expect(s.zoomPercentLabel).toBe(100);
  });

  it("marks min and max manual zoom boundaries", () => {
    expect(computeWaveformZoomBarUiState(PX_PER_SEC_MIN).atMinZoom).toBe(true);
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

  it("ultra-low px/s without viewport context is custom", () => {
    const s = computeWaveformZoomBarUiState(0.2);
    expect(s.viewMode).toBe("custom");
    expect(s.belowManualSliderRange).toBe(true);
    expect(s.atMinZoom).toBe(true);
  });
});

describe("computeCrosshairTogglePressed", () => {
  it("is off at default view while preference may stay armed", () => {
    expect(computeCrosshairTogglePressed(true, "default")).toBe(false);
  });

  it("is on for fit-selection or custom when preference is true", () => {
    expect(computeCrosshairTogglePressed(true, "fit-selection")).toBe(true);
    expect(computeCrosshairTogglePressed(true, "custom")).toBe(true);
  });
});
