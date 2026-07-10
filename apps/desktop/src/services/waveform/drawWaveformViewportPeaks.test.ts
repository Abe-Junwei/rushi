import { describe, expect, it, vi } from "vitest";
import {
  computeWaveformViewportPeaksWindow,
  computeViewportPlayedTintWidthPx,
  drawWaveformViewportPeaks,
  VIEWPORT_PEAKS_PLAYED_TINT_MIN_INTERVAL_MS,
} from "./drawWaveformViewportPeaks";

function createCtx() {
  return {
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    strokeStyle: "",
    lineWidth: 0,
  } as unknown as CanvasRenderingContext2D & {
    clearRect: ReturnType<typeof vi.fn>;
    beginPath: ReturnType<typeof vi.fn>;
    moveTo: ReturnType<typeof vi.fn>;
    lineTo: ReturnType<typeof vi.fn>;
    stroke: ReturnType<typeof vi.fn>;
  };
}

describe("drawWaveformViewportPeaks", () => {
  it("computes a viewport-sized virtual window with overscan", () => {
    const win = computeWaveformViewportPeaksWindow({
      scrollLeftPx: 2_000,
      viewportWidthPx: 800,
      timelineWidthPx: 5_000,
    });

    expect(win.leftPx).toBe(800);
    expect(win.widthPx).toBe(3_200);
    expect(win.bufferPx).toBe(1_200);
  });

  it("clamps the virtual window at timeline edges", () => {
    expect(
      computeWaveformViewportPeaksWindow({
        scrollLeftPx: 0,
        viewportWidthPx: 800,
        timelineWidthPx: 5_000,
      }).leftPx,
    ).toBe(0);
    expect(
      computeWaveformViewportPeaksWindow({
        scrollLeftPx: 4_600,
        viewportWidthPx: 800,
        timelineWidthPx: 5_000,
      }).leftPx,
    ).toBe(1_800);
  });

  it("draws base waveform and played tint as separate passes", () => {
    const ctx = createCtx();
    const peaks = new Float32Array([
      -0.25, 0.25,
      -0.5, 0.5,
      -1, 1,
      -0.1, 0.1,
    ]);

    drawWaveformViewportPeaks({
      ctx,
      peaks,
      durationSec: 4,
      timelineWidthPx: 4,
      windowLeftPx: 0,
      windowWidthPx: 4,
      heightPx: 20,
      waveColor: "gray",
      progressColor: "gold",
      playheadSec: 2,
    });

    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 4, 20);
    expect(ctx.beginPath).toHaveBeenCalledTimes(2);
    expect(ctx.stroke).toHaveBeenCalledTimes(2);
    expect(ctx.lineTo).toHaveBeenCalled();
  });

  it("computes integer played-tint width clamped to the painted window", () => {
    expect(VIEWPORT_PEAKS_PLAYED_TINT_MIN_INTERVAL_MS).toBeGreaterThan(0);
    expect(
      computeViewportPlayedTintWidthPx({
        playheadSec: 2.4,
        durationSec: 10,
        timelineWidthPx: 1000,
        windowLeftPx: 100,
        windowWidthPx: 400,
      }),
    ).toBe(140);
    expect(
      computeViewportPlayedTintWidthPx({
        playheadSec: 0,
        durationSec: 10,
        timelineWidthPx: 1000,
        windowLeftPx: 100,
        windowWidthPx: 400,
      }),
    ).toBe(0);
    expect(
      computeViewportPlayedTintWidthPx({
        playheadSec: 10,
        durationSec: 10,
        timelineWidthPx: 1000,
        windowLeftPx: 100,
        windowWidthPx: 400,
      }),
    ).toBe(400);
  });
});
