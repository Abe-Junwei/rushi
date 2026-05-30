import { describe, expect, it } from "vitest";
import {
  computeRegionActionOverlayCenterLeftPx,
  computeRegionActionOverlayLeftPx,
  estimateRegionActionOverlayWidthPx,
  WAVEFORM_REGION_ACTION_OVERLAY_EST_WIDTH_PX,
} from "./waveformRegionActionOverlay";

describe("waveformRegionActionOverlay", () => {
  it("clamps overlay left within visible viewport", () => {
    const left = computeRegionActionOverlayLeftPx({
      segmentStartPx: 50,
      segmentWidthPx: 400,
      scrollLeftPx: 100,
      viewportWidthPx: 300,
    });
    expect(left).toBe(100);
  });

  it("clamps overlay right edge inside viewport", () => {
    const left = computeRegionActionOverlayLeftPx({
      segmentStartPx: 900,
      segmentWidthPx: 200,
      scrollLeftPx: 100,
      viewportWidthPx: 300,
      overlayEstimatedWidthPx: 180,
    });
    expect(left).toBe(220);
    expect(left + 180).toBeLessThanOrEqual(100 + 300);
  });

  it("centers overlay within segment when fully visible", () => {
    const widthPx = estimateRegionActionOverlayWidthPx({ showSpeedMenu: true, showLoopBtn: true });
    const left = computeRegionActionOverlayCenterLeftPx({
      segmentStartPx: 200,
      segmentWidthPx: 400,
      scrollLeftPx: 0,
      viewportWidthPx: 800,
      overlayEstimatedWidthPx: widthPx,
    });
    expect(left).toBeCloseTo(200 + 400 / 2 - widthPx / 2, 4);
  });

  it("clamps centered overlay inside viewport", () => {
    const left = computeRegionActionOverlayCenterLeftPx({
      segmentStartPx: 900,
      segmentWidthPx: 200,
      scrollLeftPx: 100,
      viewportWidthPx: 300,
      overlayEstimatedWidthPx: 110,
    });
    expect(left).toBe(290);
    expect(left + 110).toBeLessThanOrEqual(400);
  });

  it("uses default estimated width", () => {
    expect(WAVEFORM_REGION_ACTION_OVERLAY_EST_WIDTH_PX).toBeGreaterThan(100);
  });
});
