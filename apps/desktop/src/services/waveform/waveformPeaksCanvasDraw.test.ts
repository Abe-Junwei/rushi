import { describe, expect, it, vi } from "vitest";
import { drawWaveformPeaksViewport } from "./waveformPeaksCanvasDraw";

describe("drawWaveformPeaksViewport", () => {
  it("draws without throwing for a small peaks slice", () => {
    const ctx = {
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      setTransform: vi.fn(),
      fillStyle: "",
      canvas: { width: 120, height: 48 },
    } as unknown as CanvasRenderingContext2D;

    const peaks = [0, 0.5, -0.2, 0.3, 0.1, 0.8];
    expect(() =>
      drawWaveformPeaksViewport(ctx, peaks, {
        heightPx: 48,
        scrollLeftPx: 0,
        viewportWidthPx: 120,
        progressTimeSec: 0,
        pxPerSec: 20,
        durationSec: 10,
        waveColor: "#ccc",
        progressColor: "#888",
      }),
    ).not.toThrow();
    expect(ctx.fillRect).toHaveBeenCalled();
  });

  it("draws visible columns when scrollLeft is non-zero", () => {
    const ctx = {
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      setTransform: vi.fn(),
      fillStyle: "",
      canvas: { width: 120, height: 48 },
    } as unknown as CanvasRenderingContext2D;

    const peaks: number[] = [];
    for (let i = 0; i < 200; i++) {
      peaks.push(-0.5, 0.5);
    }
    drawWaveformPeaksViewport(ctx, peaks, {
      heightPx: 48,
      scrollLeftPx: 90,
      viewportWidthPx: 120,
      progressTimeSec: 0,
      pxPerSec: 20,
      durationSec: 10,
      waveColor: "#ccc",
      progressColor: "#888",
      barWidth: 2,
      barGap: 1,
    });
    expect(ctx.fillRect).toHaveBeenCalled();
  });

  it("clamps scroll beyond timeline width so zoom mode still draws", () => {
    const ctx = {
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      setTransform: vi.fn(),
      fillStyle: "",
      canvas: { width: 120, height: 48 },
    } as unknown as CanvasRenderingContext2D;

    const peaks: number[] = [];
    for (let i = 0; i < 40; i++) {
      peaks.push(-0.5, 0.5);
    }
    drawWaveformPeaksViewport(ctx, peaks, {
      heightPx: 48,
      scrollLeftPx: 50_000,
      viewportWidthPx: 120,
      progressTimeSec: 0,
      pxPerSec: 80,
      durationSec: 1,
      waveColor: "#ccc",
      progressColor: "#888",
      barWidth: 2,
      barGap: 1,
    });
    expect(ctx.fillRect).toHaveBeenCalled();
  });

  it("colors played bars using timeline coordinates", () => {
    const colors: string[] = [];
    const ctx = {
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      setTransform: vi.fn(),
      get fillStyle() {
        return colors[colors.length - 1] ?? "";
      },
      set fillStyle(value: string) {
        colors.push(value);
      },
      canvas: { width: 120, height: 48 },
    } as unknown as CanvasRenderingContext2D;

    const peaks: number[] = [];
    for (let i = 0; i < 40; i++) {
      peaks.push(-0.5, 0.5);
    }
    drawWaveformPeaksViewport(ctx, peaks, {
      heightPx: 48,
      scrollLeftPx: 0,
      viewportWidthPx: 120,
      progressTimeSec: 0.15,
      pxPerSec: 20,
      durationSec: 2,
      waveColor: "wave",
      progressColor: "progress",
      barWidth: 2,
      barGap: 1,
    });
    expect(colors).toContain("progress");
    expect(colors).toContain("wave");
  });
});
