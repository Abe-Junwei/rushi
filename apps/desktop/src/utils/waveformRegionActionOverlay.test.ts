import { describe, expect, it } from "vitest";
import {
  computeRegionActionOverlayLeftPx,
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

  it("uses default estimated width", () => {
    expect(WAVEFORM_REGION_ACTION_OVERLAY_EST_WIDTH_PX).toBeGreaterThan(100);
  });
});
