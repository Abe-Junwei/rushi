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
        waveColor: "#ccc",
        progressColor: "#888",
      }),
    ).not.toThrow();
    expect(ctx.fillRect).toHaveBeenCalled();
  });
});
