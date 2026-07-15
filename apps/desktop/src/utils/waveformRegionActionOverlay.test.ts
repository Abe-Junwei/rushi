import { describe, expect, it } from "vitest";
import {
  computeRegionActionOverlayCenterLeftPx,
  computeRegionActionOverlayLeftPx,
  estimateRegionActionOverlayWidthPx,
  resolveSegmentPlaybackControlVisibility,
  resolveSegmentPlaybackControlsOverlayLayout,
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
    const widthPx = estimateRegionActionOverlayWidthPx({ showLoopBtn: true });
    const left = computeRegionActionOverlayCenterLeftPx({
      segmentStartPx: 200,
      segmentWidthPx: 400,
      scrollLeftPx: 0,
      viewportWidthPx: 800,
      overlayEstimatedWidthPx: widthPx,
    });
    expect(left).toBeCloseTo(200 + 400 / 2 - widthPx / 2, 4);
  });

  it("keeps overlay inside segment when segment extends beyond viewport", () => {
    const left = computeRegionActionOverlayCenterLeftPx({
      segmentStartPx: 900,
      segmentWidthPx: 200,
      scrollLeftPx: 100,
      viewportWidthPx: 300,
      overlayEstimatedWidthPx: 110,
    });
    expect(left).toBeGreaterThanOrEqual(900);
    expect(left + 110).toBeLessThanOrEqual(1100);
  });

  it("uses default estimated width", () => {
    expect(WAVEFORM_REGION_ACTION_OVERLAY_EST_WIDTH_PX).toBeGreaterThan(100);
  });

  it("resolveSegmentPlaybackControlsOverlayLayout hides off-screen segments", () => {
    const layout = resolveSegmentPlaybackControlsOverlayLayout({
      segmentStartSec: 0,
      segmentEndSec: 2,
      timelineWidthPx: 3000,
      durationSec: 30,
      scrollLeftPx: 500,
      viewportWidthPx: 400,
    });
    expect(layout.visible).toBe(false);
  });

  it("resolveSegmentPlaybackControlsOverlayLayout uses timeline coordinates when requested", () => {
    const layout = resolveSegmentPlaybackControlsOverlayLayout({
      segmentStartSec: 10,
      segmentEndSec: 12,
      timelineWidthPx: 3000,
      durationSec: 30,
      scrollLeftPx: 900,
      viewportWidthPx: 400,
      coordinateSpace: "timeline",
    });
    expect(layout.visible).toBe(true);
    expect(layout.overlayLeftPx + layout.overlayWidthPx / 2).toBeCloseTo(1100, 0);
    expect(layout.overlayLeftPx).toBeGreaterThanOrEqual(1000);
    expect(layout.overlayLeftPx + layout.overlayWidthPx).toBeLessThanOrEqual(1200);
  });

  it("keeps timeline-space controls in the visible segment portion", () => {
    const layout = resolveSegmentPlaybackControlsOverlayLayout({
      segmentStartSec: 0,
      segmentEndSec: 30,
      timelineWidthPx: 3000,
      durationSec: 30,
      scrollLeftPx: 1200,
      viewportWidthPx: 400,
      coordinateSpace: "timeline",
    });
    expect(layout.visible).toBe(true);
    expect(layout.overlayLeftPx).toBeGreaterThanOrEqual(1200);
    expect(layout.overlayLeftPx + layout.overlayWidthPx).toBeLessThanOrEqual(1600);
  });

  it("resolveSegmentPlaybackControlsOverlayLayout centers in sticky viewport coordinates", () => {
    const layout = resolveSegmentPlaybackControlsOverlayLayout({
      segmentStartSec: 10,
      segmentEndSec: 12,
      timelineWidthPx: 3000,
      durationSec: 30,
      scrollLeftPx: 900,
      viewportWidthPx: 400,
    });
    expect(layout.visible).toBe(true);
    const segCenterVp = (1000 + 1200) / 2 - 900;
    expect(layout.overlayLeftPx + layout.overlayWidthPx / 2).toBeCloseTo(segCenterVp, 0);
    expect(layout.overlayLeftPx).toBeGreaterThanOrEqual(100);
    expect(layout.overlayLeftPx + layout.overlayWidthPx).toBeLessThanOrEqual(300);
  });

  it("keeps overlay inside segment when scroll is ahead of segment end", () => {
    const widthPx = estimateRegionActionOverlayWidthPx({ showLoopBtn: false });
    const left = computeRegionActionOverlayCenterLeftPx({
      segmentStartPx: 100,
      segmentWidthPx: 100,
      scrollLeftPx: 250,
      viewportWidthPx: 200,
      overlayEstimatedWidthPx: widthPx,
    });
    expect(left).toBeGreaterThanOrEqual(100);
    expect(left + widthPx).toBeLessThanOrEqual(200);
  });

  it("centers overlay on visible segment portion when partially in viewport", () => {
    const widthPx = estimateRegionActionOverlayWidthPx({ showLoopBtn: false });
    const left = computeRegionActionOverlayCenterLeftPx({
      segmentStartPx: 100,
      segmentWidthPx: 400,
      scrollLeftPx: 450,
      viewportWidthPx: 200,
      overlayEstimatedWidthPx: widthPx,
    });
    const visibleCenter = 450 + (500 - 450) / 2;
    expect(left).toBeCloseTo(visibleCenter - widthPx / 2, 4);
  });

  it("resolveSegmentPlaybackControlVisibility shows loop when wide enough", () => {
    const loopPlayWidth = estimateRegionActionOverlayWidthPx({ showLoopBtn: true });
    const playOnlyWidth = estimateRegionActionOverlayWidthPx({ showLoopBtn: false });
    expect(resolveSegmentPlaybackControlVisibility(110).showLoopBtn).toBe(true);
    expect(resolveSegmentPlaybackControlVisibility(loopPlayWidth).showLoopBtn).toBe(true);
    expect(resolveSegmentPlaybackControlVisibility(playOnlyWidth - 1).showLoopBtn).toBe(false);
  });

  it("uses visible segment width when partially off-screen", () => {
    const layout = resolveSegmentPlaybackControlsOverlayLayout({
      segmentStartSec: 0,
      segmentEndSec: 30,
      timelineWidthPx: 3000,
      durationSec: 30,
      scrollLeftPx: 2970,
      viewportWidthPx: 200,
    });
    expect(layout.visible).toBe(true);
    expect(layout.visibleSegmentWidthPx).toBe(30);
    expect(layout.showLoopBtn).toBe(false);
  });

  it("centers on segment after list-select zoom scroll in viewport space", () => {
    const layout = resolveSegmentPlaybackControlsOverlayLayout({
      segmentStartSec: 155,
      segmentEndSec: 165,
      timelineWidthPx: 6000,
      durationSec: 600,
      scrollLeftPx: 1200,
      viewportWidthPx: 800,
    });
    expect(layout.visible).toBe(true);
    const segLeftPx = (155 / 600) * 6000;
    const segRightPx = (165 / 600) * 6000;
    const segCenterVp = (segLeftPx + segRightPx) / 2 - 1200;
    expect(layout.overlayLeftPx + layout.overlayWidthPx / 2).toBeCloseTo(segCenterVp, 0);
  });
});
