import { describe, expect, it, vi } from "vitest";
import { drawWaveformPeaksTile } from "./waveformPeaksCanvasDraw";

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
    expect(Math.max(...xs)).toBeGreaterThan(160);
  });

  it("draws overview-style full-width tile at scroll 0", () => {
    const ctx = makeCtx(400, 32);
    const peaks: number[] = [];
    for (let i = 0; i < 80; i++) peaks.push(-0.5, 0.5);

    drawWaveformPeaksTile(ctx, peaks, {
      tileLeftPx: 0,
      tileWidthPx: 400,
      timelineWidthPx: 400,
      heightPx: 32,
      pxPerSec: 40,
      durationSec: 10,
      waveColor: "#ccc",
      barWidth: 2,
      barGap: 1,
    });

    expect(ctx.fillRect).toHaveBeenCalled();
  });
});
