import { describe, expect, it } from "vitest";
import { drawWaveformMinimap } from "./drawWaveformMinimap";

function createMockCtx(width: number, height: number) {
  const fillRects: Array<{ x: number; y: number; w: number; h: number }> = [];
  return {
    ctx: {
      clearRect: () => {},
      fillStyle: "",
      fillRect(x: number, y: number, w: number, h: number) {
        fillRects.push({ x, y, w, h });
      },
    } as unknown as CanvasRenderingContext2D,
    fillRects,
    width,
    height,
  };
}

describe("drawWaveformMinimap", () => {
  it("draws one column per peak bucket when colCount <= width", () => {
    const { ctx, fillRects } = createMockCtx(4, 20);
    drawWaveformMinimap(ctx, [-0.5, 0.5, -0.2, 0.8, -0.1, 0.3, -0.4, 0.4], 4, 20);
    expect(fillRects).toHaveLength(4);
    for (const rect of fillRects) {
      expect(rect.y + rect.h / 2).toBeCloseTo(10, 0);
    }
  });

  it("buckets peaks when colCount exceeds canvas width", () => {
    const peaks = new Float32Array(2000);
    for (let i = 0; i < 1000; i += 1) {
      peaks[i * 2] = -0.5;
      peaks[i * 2 + 1] = 0.5;
    }
    const { ctx, fillRects } = createMockCtx(100, 20);
    drawWaveformMinimap(ctx, peaks, 100, 20);
    expect(fillRects).toHaveLength(100);
    expect(fillRects.every((r) => r.w === 1)).toBe(true);
  });
});
