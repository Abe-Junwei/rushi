import { bench, describe } from "vitest";
import { drawWaveformPeaksTile } from "./waveformPeaksCanvasDraw";

function makeCtx(width: number, height: number): CanvasRenderingContext2D {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas.getContext("2d")!;
}

describe("drawWaveformPeaksTile", () => {
  const peaks: number[] = [];
  for (let i = 0; i < 4000; i++) peaks.push(-0.5, 0.5);

  bench("4096px tile with 4000 columns", () => {
    const ctx = makeCtx(4096, 200);
    drawWaveformPeaksTile(ctx, peaks, {
      tileLeftPx: 0,
      tileWidthPx: 4096,
      timelineWidthPx: 20000,
      heightPx: 200,
      pxPerSec: 200,
      peakDurationSec: 100,
      mediaDurationSec: 100,
      waveColor: "#ccc",
      barWidth: 2,
      barGap: 1,
    });
  });

  bench("8192px tile with 8000 columns", () => {
    const ctx = makeCtx(8192, 200);
    const bigPeaks: number[] = [];
    for (let i = 0; i < 8000; i++) bigPeaks.push(-0.5, 0.5);
    drawWaveformPeaksTile(ctx, bigPeaks, {
      tileLeftPx: 0,
      tileWidthPx: 8192,
      timelineWidthPx: 40000,
      heightPx: 200,
      pxPerSec: 400,
      peakDurationSec: 100,
      mediaDurationSec: 100,
      waveColor: "#ccc",
      barWidth: 2,
      barGap: 1,
    });
  });
});
