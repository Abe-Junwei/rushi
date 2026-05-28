import { describe, expect, it, vi } from "vitest";
import { drawWaveformPeaksTile, drawWaveformPeaksViewport } from "./waveformPeaksCanvasDraw";

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

  it("maps timeline scroll to coarse LOD columns (non-zero scroll)", () => {
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
      scrollLeftPx: 500,
      viewportWidthPx: 120,
      progressTimeSec: 0,
      pxPerSec: 80,
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

  it("draws mid-timeline viewport when timelineWidthPx exceeds raw peak width (long audio fit-all)", () => {
    const ctx = {
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      setTransform: vi.fn(),
      fillStyle: "",
      canvas: { width: 120, height: 48 },
    } as unknown as CanvasRenderingContext2D;

    const peaks: number[] = [];
    for (let i = 0; i < 320; i++) peaks.push(-0.4, 0.4);

    drawWaveformPeaksViewport(ctx, peaks, {
      heightPx: 48,
      scrollLeftPx: 160,
      viewportWidthPx: 120,
      progressTimeSec: 0,
      pxPerSec: 0.05,
      durationSec: 600,
      timelineWidthPx: 320,
      waveColor: "#ccc",
      progressColor: "#888",
      barWidth: 2,
      barGap: 1,
    });

    const calls = (ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const xs = calls.map(([x]) => x as number);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(-2);
    expect(Math.max(...xs)).toBeLessThanOrEqual(120);
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

describe("drawWaveformPeaksTile", () => {
  const makeCtx = (width = 4096, height = 48) =>
    ({
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      setTransform: vi.fn(),
      fillStyle: "",
      canvas: { width, height },
    }) as unknown as CanvasRenderingContext2D;

  it("draws without throwing for the first tile", () => {
    const ctx = makeCtx();
    const peaks: number[] = [];
    for (let i = 0; i < 200; i++) peaks.push(-0.5, 0.5);
    expect(() =>
      drawWaveformPeaksTile(ctx, peaks, {
        tileLeftPx: 0,
        tileWidthPx: 4096,
        timelineWidthPx: 200,
        heightPx: 48,
        pxPerSec: 20,
        durationSec: 10,
        waveColor: "#ccc",
      }),
    ).not.toThrow();
    expect(ctx.fillRect).toHaveBeenCalled();
  });

  it("only draws bars within its own tile range", () => {
    const ctx = makeCtx();
    const peaks: number[] = [];
    for (let i = 0; i < 1000; i++) peaks.push(-0.5, 0.5);

    drawWaveformPeaksTile(ctx, peaks, {
      tileLeftPx: 4096,
      tileWidthPx: 4096,
      timelineWidthPx: 10000,
      heightPx: 48,
      pxPerSec: 200,
      durationSec: 50,
      waveColor: "#ccc",
      barWidth: 2,
      barGap: 1,
    });

    const calls = (ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    // x is tile-local, so must lie in [-2, tileWidthPx]
    for (const [x] of calls) {
      expect(x as number).toBeGreaterThanOrEqual(-2);
      expect(x as number).toBeLessThanOrEqual(4096);
    }
  });

  it("never paints progress color (tile is single-color)", () => {
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
      canvas: { width: 4096, height: 48 },
    } as unknown as CanvasRenderingContext2D;

    const peaks: number[] = [];
    for (let i = 0; i < 200; i++) peaks.push(-0.5, 0.5);

    drawWaveformPeaksTile(ctx, peaks, {
      tileLeftPx: 0,
      tileWidthPx: 4096,
      timelineWidthPx: 200,
      heightPx: 48,
      pxPerSec: 20,
      durationSec: 10,
      waveColor: "wave",
    });

    expect(colors).toContain("wave");
    expect(colors).not.toContain("progress");
  });

  it("no-ops when tileWidthPx or peaks degenerate", () => {
    const ctx = makeCtx();
    drawWaveformPeaksTile(ctx, [], {
      tileLeftPx: 0,
      tileWidthPx: 4096,
      timelineWidthPx: 200,
      heightPx: 48,
      pxPerSec: 20,
      durationSec: 10,
      waveColor: "#ccc",
    });
    expect(ctx.fillRect).not.toHaveBeenCalled();

    drawWaveformPeaksTile(ctx, [0, 1, 0, 1], {
      tileLeftPx: 0,
      tileWidthPx: 0,
      timelineWidthPx: 200,
      heightPx: 48,
      pxPerSec: 20,
      durationSec: 10,
      waveColor: "#ccc",
    });
    expect(ctx.fillRect).not.toHaveBeenCalled();
  });

  it("distributes peaks across timelineWidthPx (not pxPerSec*duration) so fit-all on long audio fills the tile", () => {
    // Regression for "blank waveform with 0 px/s display" bug:
    // - duration=600s, pxPerSec=0.05 → raw peak width = 30 px
    // - computeTimelineWidthPx applies a 320 px floor → tile widthPx = 320
    // - Without timelineWidthPx-based distribution, peaks would clump into the
    //   first 30 px of the tile, leaving the rest blank.
    const ctx = makeCtx(320, 48);
    const peaks: number[] = [];
    for (let i = 0; i < 30; i++) peaks.push(-0.4, 0.4);

    drawWaveformPeaksTile(ctx, peaks, {
      tileLeftPx: 0,
      tileWidthPx: 320,
      timelineWidthPx: 320,
      heightPx: 48,
      pxPerSec: 0.05,
      durationSec: 600,
      waveColor: "#ccc",
      barWidth: 2,
      barGap: 1,
    });

    const calls = (ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const xs = calls.map(([x]) => x as number);
    // Peaks should span most of the tile width, not be clumped into the left
    // 30 px slice. Demand that at least one bar lands past the right half.
    expect(Math.max(...xs)).toBeGreaterThan(160);
  });
});
