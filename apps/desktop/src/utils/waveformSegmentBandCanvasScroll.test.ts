import { describe, expect, it } from "vitest";
import {
  computeSegmentBandCanvasWindow,
  segmentBandCanvasNeedsRepaint,
  SEGMENT_BAND_CANVAS_BUFFER_VIEWPORTS,
} from "./waveformSegmentBandCanvasScroll";

describe("computeSegmentBandCanvasWindow", () => {
  it("uses buffer viewports on each side", () => {
    const { bufferPx, widthPx } = computeSegmentBandCanvasWindow({
      scrollLeftPx: 1000,
      viewportWidthPx: 1000,
      timelineWidthPx: 20_000,
    });
    expect(bufferPx).toBe(1000 * SEGMENT_BAND_CANVAS_BUFFER_VIEWPORTS);
    expect(widthPx).toBe(1000 + bufferPx * 2);
  });
});

describe("segmentBandCanvasNeedsRepaint", () => {
  const basePaint = {
    paintedLeftPx: 0,
    paintedWidthPx: 4000,
    paintedHeightPx: 120,
    layoutHeightPx: 120,
    bufferPx: 1500,
    viewportWidthPx: 1000,
    timelineWidthPx: 20_000,
  };

  it("requires first paint", () => {
    expect(
      segmentBandCanvasNeedsRepaint({
        ...basePaint,
        scrollLeftPx: 1000,
        paintedLeftPx: -1,
        paintedWidthPx: 0,
      }),
    ).toBe(true);
  });

  it("skips repaint while viewport stays inside painted window", () => {
    expect(
      segmentBandCanvasNeedsRepaint({
        ...basePaint,
        scrollLeftPx: 1100,
      }),
    ).toBe(false);
    expect(
      segmentBandCanvasNeedsRepaint({
        ...basePaint,
        scrollLeftPx: 1500,
      }),
    ).toBe(false);
  });

  it("skips repeated repaint when the painted window is clamped to timeline start", () => {
    expect(
      segmentBandCanvasNeedsRepaint({
        ...basePaint,
        scrollLeftPx: 0,
      }),
    ).toBe(false);
  });

  it("skips repeated repaint when the painted window is clamped to timeline end", () => {
    expect(
      segmentBandCanvasNeedsRepaint({
        ...basePaint,
        scrollLeftPx: 19_000,
        paintedLeftPx: 16_000,
      }),
    ).toBe(false);
  });

  it("preserves buffered safe area for a window away from timeline boundaries", () => {
    expect(
      segmentBandCanvasNeedsRepaint({
        ...basePaint,
        scrollLeftPx: 5600,
        paintedLeftPx: 5000,
      }),
    ).toBe(false);
  });

  it("repaints when viewport nears trailing edge", () => {
    expect(
      segmentBandCanvasNeedsRepaint({
        ...basePaint,
        scrollLeftPx: 3600,
      }),
    ).toBe(true);
  });

  it("repaints on height change", () => {
    expect(
      segmentBandCanvasNeedsRepaint({
        ...basePaint,
        scrollLeftPx: 1100,
        layoutHeightPx: 140,
      }),
    ).toBe(true);
  });
});
