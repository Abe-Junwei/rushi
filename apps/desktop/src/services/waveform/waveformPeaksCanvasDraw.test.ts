import { describe, expect, it, vi } from "vitest";
import { drawWaveformPeaksTile } from "./waveformPeaksCanvasDraw";

const sameDuration = (sec: number) => ({
  peakDurationSec: sec,
  mediaDurationSec: sec,
});

const makePeaks = (count: number) => {
  const peaks: number[] = [];
  for (let i = 0; i < count; i++) peaks.push(-0.5, 0.5);
  return peaks;
};

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
    expect(() =>
      drawWaveformPeaksTile(ctx, makePeaks(200), {
        tileLeftPx: 0,
        tileWidthPx: 4096,
        timelineWidthPx: 200,
        heightPx: 48,
        pxPerSec: 20,
        ...sameDuration(10),
        waveColor: "#ccc",
      }),
    ).not.toThrow();
    expect(ctx.fillRect).toHaveBeenCalled();
  });

  it("only draws bars within its own tile range", () => {
    const ctx = makeCtx();
    drawWaveformPeaksTile(ctx, makePeaks(1000), {
      tileLeftPx: 4096,
      tileWidthPx: 4096,
      timelineWidthPx: 10000,
      heightPx: 48,
      pxPerSec: 200,
      ...sameDuration(50),
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

    drawWaveformPeaksTile(ctx, makePeaks(200), {
      tileLeftPx: 0,
      tileWidthPx: 4096,
      timelineWidthPx: 200,
      heightPx: 48,
      pxPerSec: 20,
      ...sameDuration(10),
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
      ...sameDuration(10),
      waveColor: "#ccc",
    });
    expect(ctx.fillRect).not.toHaveBeenCalled();

    drawWaveformPeaksTile(ctx, [0, 1, 0, 1], {
      tileLeftPx: 0,
      tileWidthPx: 0,
      timelineWidthPx: 200,
      heightPx: 48,
      pxPerSec: 20,
      ...sameDuration(10),
      waveColor: "#ccc",
    });
    expect(ctx.fillRect).not.toHaveBeenCalled();
  });

  it("distributes peaks across timelineWidthPx (not pxPerSec*duration) so fit-all on long audio fills the tile", () => {
    const ctx = makeCtx(320, 48);
    const peaks = makePeaks(30);
    for (let i = 0; i < peaks.length; i++) peaks[i] *= 0.8;
    drawWaveformPeaksTile(ctx, peaks, {
      tileLeftPx: 0,
      tileWidthPx: 320,
      timelineWidthPx: 320,
      heightPx: 48,
      pxPerSec: 0.05,
      ...sameDuration(600),
      waveColor: "#ccc",
      barWidth: 2,
      barGap: 1,
    });

    const calls = (ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const xs = calls.map(([x]) => x as number);
    expect(Math.max(...xs)).toBeGreaterThan(160);
  });

  it("draws mid-timeline tile on layout width when peak span covers the tile", () => {
    const ctx = makeCtx(4096, 48);
    const layoutTimelineWidthPx = 10_000;
    const tileLeftPx = 8_200;
    const tileWidthPx = 1_500;

    expect(
      drawWaveformPeaksTile(ctx, makePeaks(1000), {
        tileLeftPx,
        tileWidthPx,
        timelineWidthPx: 8_000,
        heightPx: 48,
        pxPerSec: 80,
        ...sameDuration(100),
        waveColor: "#ccc",
        barWidth: 2,
        barGap: 1,
      }),
    ).toBe(false);
    expect(ctx.fillRect).not.toHaveBeenCalled();

    (ctx.fillRect as ReturnType<typeof vi.fn>).mockClear();
    expect(
      drawWaveformPeaksTile(ctx, makePeaks(1000), {
        tileLeftPx,
        tileWidthPx,
        timelineWidthPx: layoutTimelineWidthPx,
        heightPx: 48,
        pxPerSec: 80,
        ...sameDuration(100),
        waveColor: "#ccc",
        barWidth: 2,
        barGap: 1,
      }),
    ).toBe(true);
    expect(ctx.fillRect).toHaveBeenCalled();
  });

  it("throws when peaks coverage is below 98%", () => {
    const ctx = makeCtx(4096, 48);
    expect(() =>
      drawWaveformPeaksTile(ctx, makePeaks(40992), {
        tileLeftPx: 40_950,
        tileWidthPx: 4_095,
        timelineWidthPx: 66_920,
        heightPx: 48,
        pxPerSec: 56,
        peakDurationSec: 732,
        mediaDurationSec: 1195,
        waveColor: "#ccc",
        barWidth: 2,
        barGap: 1,
      }),
    ).toThrow("Peaks coverage insufficient");
  });

  it("fills the right-edge tile when peaks cover ~99% of media (VBR / rounding drift)", () => {
    const ctx = makeCtx(4096, 48);
    const mediaDurationSec = 1195;
    const peakDurationSec = 1190; // 0.9958 coverage — effectively complete
    const layoutTimelineWidthPx = 66_920;
    // Without stretch-to-fill, peakLayoutSpanPx ≈ 66_640, so this tile (left ≥ that)
    // would be entirely past the peak span and render as a blank grey tile.
    const tileLeftPx = 66_700;

    expect(
      drawWaveformPeaksTile(ctx, makePeaks(40992), {
        tileLeftPx,
        tileWidthPx: layoutTimelineWidthPx - tileLeftPx,
        timelineWidthPx: layoutTimelineWidthPx,
        heightPx: 48,
        pxPerSec: 56,
        peakDurationSec,
        mediaDurationSec,
        waveColor: "#ccc",
        barWidth: 2,
        barGap: 1,
      }),
    ).toBe(true);
    expect(ctx.fillRect).toHaveBeenCalled();
  });

  it("throws for any tile when peaks coverage is below 98%", () => {
    const ctx = makeCtx(4096, 48);
    expect(() =>
      drawWaveformPeaksTile(ctx, makePeaks(40992), {
        tileLeftPx: 41_000,
        tileWidthPx: 4_095,
        timelineWidthPx: 66_920,
        heightPx: 48,
        pxPerSec: 56,
        peakDurationSec: 732,
        mediaDurationSec: 1195,
        waveColor: "#ccc",
        barWidth: 2,
        barGap: 1,
      }),
    ).toThrow("Peaks coverage insufficient");
  });

  it("draws overview-style full-width tile at scroll 0", () => {
    const ctx = makeCtx(400, 32);
    drawWaveformPeaksTile(ctx, makePeaks(80), {
      tileLeftPx: 0,
      tileWidthPx: 400,
      timelineWidthPx: 400,
      heightPx: 32,
      pxPerSec: 40,
      ...sameDuration(10),
      waveColor: "#ccc",
      barWidth: 2,
      barGap: 1,
    });

    expect(ctx.fillRect).toHaveBeenCalled();
  });

  it("throws when overview peaks coverage is below 98%", () => {
    const ctx = makeCtx(400, 32);
    expect(() =>
      drawWaveformPeaksTile(ctx, makePeaks(200), {
        tileLeftPx: 0,
        tileWidthPx: 400,
        timelineWidthPx: 400,
        heightPx: 32,
        pxPerSec: 0.48,
        peakDurationSec: 960,
        mediaDurationSec: 1263,
        waveColor: "#ccc",
        barWidth: 2,
        barGap: 1,
      }),
    ).toThrow("Peaks coverage insufficient");
  });
});
