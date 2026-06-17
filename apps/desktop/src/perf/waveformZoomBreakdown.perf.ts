/**
 * Zoom 帧耗时分解 — 主线程 micro-benchmark。
 * 运行：`npm run test:perf -w @rushi/desktop -- waveformZoomBreakdown`
 *
 * 覆盖：PeakCache 路径上的 resample / toPeaks / segment bands。
 * WS `load` / `reRender` 需真实 Canvas（jsdom 无 2d）；见仓库内手测说明或 DevTools Performance。
 */
import WaveformData from "waveform-data";
import { describe, expect, it } from "vitest";
import {
  resampleWaveformForPxPerSec,
  waveformDataToWaveSurferPeaks,
} from "../services/waveform/audiowaveformDat";
import { drawWaveformSegmentBands } from "../services/waveform/drawWaveformSegmentBands";
import { capWaveformPeakColumns, computeTimelineWidthPx, MAX_WAVESURFER_PEAK_COLUMNS } from "../utils/pxPerSec";
import type { SegmentDto } from "../tauri/projectApi";

type Timed = { label: string; ms: number; detail?: string };

function elapsedMs(run: () => void): number {
  const start = performance.now();
  run();
  return performance.now() - start;
}

function medianMs(runs: number, fn: () => void): number {
  const samples: number[] = [];
  for (let i = 0; i < runs; i += 1) samples.push(elapsedMs(fn));
  samples.sort((a, b) => a - b);
  return samples[Math.floor(samples.length / 2)] ?? 0;
}

function createSyntheticWaveformData(durationSec: number, pixelsPerSecond: number): WaveformData {
  const sampleRate = 44_100;
  const length = Math.max(1, Math.ceil(durationSec * pixelsPerSecond));
  const samplesPerPixel = Math.max(1, Math.floor(sampleRate / pixelsPerSecond));
  const headerSize = 24;
  const buffer = new ArrayBuffer(headerSize + length * 4);
  const view = new DataView(buffer);
  view.setInt32(0, 2, true);
  view.setUint32(4, 0, true);
  view.setInt32(8, sampleRate, true);
  view.setInt32(12, samplesPerPixel, true);
  view.setInt32(16, length, true);
  view.setInt32(20, 1, true);
  let offset = headerSize;
  for (let i = 0; i < length; i += 1) {
    view.setInt16(offset, Math.floor(Math.sin(i * 0.03) * 12_000), true);
    offset += 2;
    view.setInt16(offset, Math.floor(Math.cos(i * 0.03) * 16_000), true);
    offset += 2;
  }
  return WaveformData.create(buffer);
}

function makeSegments(count: number, durationSec: number): SegmentDto[] {
  const span = durationSec / count;
  return Array.from({ length: count }, (_, idx) => ({
    idx,
    uid: `seg-${idx}`,
    start_sec: idx * span,
    end_sec: idx * span + span * 0.85,
    text: `segment ${idx}`,
    confidence: null,
    low_confidence: false,
    detail: null,
    kind: "speech",
  }));
}

/** 模拟 WS bar 绘制主循环（无 Canvas，仅 CPU 工作量代理）。 */
function simulateBarDrawOps(cols: number): number {
  const barWidth = 2;
  const barGap = 1;
  const step = barWidth + barGap;
  let ops = 0;
  for (let x = 0; x < cols; x += step) ops += 1;
  return ops;
}

function formatBreakdown(rows: Timed[]): string {
  const total = rows.reduce((sum, row) => sum + row.ms, 0);
  return rows
    .map((row) => {
      const pct = total > 0 ? ((row.ms / total) * 100).toFixed(0) : "0";
      const detail = row.detail ? ` (${row.detail})` : "";
      return `  ${row.label.padEnd(32)} ${row.ms.toFixed(2).padStart(8)} ms  ${pct.padStart(3)}%${detail}`;
    })
    .join("\n");
}

function mockSegmentBandCtx(): CanvasRenderingContext2D {
  return {
    clearRect: () => {},
    fillRect: () => {},
    stroke: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
  } as unknown as CanvasRenderingContext2D;
}

describe("waveform zoom frame breakdown", () => {
  it("cross-LOD / high zoom — resample dominates (10 min)", () => {
    const durationSec = 600;
    const l3 = createSyntheticWaveformData(durationSec, 800);
    const pxTo = 400;
    const targetCols = capWaveformPeakColumns(computeTimelineWidthPx(durationSec, pxTo));

    const rows: Timed[] = [
      {
        label: "resample L3→cap",
        ms: medianMs(5, () => {
          resampleWaveformForPxPerSec(l3, pxTo, durationSec);
        }),
        detail: `${l3.length}→${targetCols} cols`,
      },
    ];

    const resampled = resampleWaveformForPxPerSec(l3, pxTo, durationSec);
    rows.push({
      label: "toPeaks Float32",
      ms: medianMs(5, () => waveformDataToWaveSurferPeaks(resampled)),
      detail: `${resampled.length} cols`,
    });

    const ctx = mockSegmentBandCtx();
    rows.push({
      label: "segment bands (5000)",
      ms: medianMs(8, () => {
        drawWaveformSegmentBands({
          ctx,
          segments: makeSegments(5000, durationSec),
          scrollLeftPx: 12_000,
          viewportWidthPx: 1200,
          timelineWidthPx: targetCols,
          durationSec,
          layoutHeightPx: 96,
        });
      }),
    });

    rows.push({
      label: "bar draw ops (proxy)",
      ms: medianMs(5, () => {
        simulateBarDrawOps(targetCols);
      }),
      detail: `${simulateBarDrawOps(targetCols)} rects`,
    });

    // eslint-disable-next-line no-console -- perf report
    console.info(`\n[waveform-zoom] 10min cross-zoom @ ${pxTo}px/s\n${formatBreakdown(rows)}\n`);

    expect(rows[0].ms).toBeGreaterThan(1);
    expect(rows[0].ms).toBeGreaterThan(rows[2].ms);
  });

  it("same-LOD stretch — resample ~0; segment bands still negligible", () => {
    const durationSec = 600;
    const l1 = createSyntheticWaveformData(durationSec, 20);
    const rows: Timed[] = [
      {
        label: "resample skip (upsample)",
        ms: medianMs(10, () => {
          resampleWaveformForPxPerSec(l1, 64, durationSec);
        }),
        detail: `base ${l1.length} cols`,
      },
      {
        label: "toPeaks (12k)",
        ms: medianMs(5, () => waveformDataToWaveSurferPeaks(l1)),
      },
      {
        label: "segment bands (5000)",
        ms: medianMs(8, () => {
          drawWaveformSegmentBands({
            ctx: mockSegmentBandCtx(),
            segments: makeSegments(5000, durationSec),
            scrollLeftPx: 12_000,
            viewportWidthPx: 1200,
            timelineWidthPx: MAX_WAVESURFER_PEAK_COLUMNS,
            durationSec,
            layoutHeightPx: 96,
          });
        }),
      },
    ];

    // eslint-disable-next-line no-console -- perf report
    console.info(`\n[waveform-zoom] 10min same-LOD stretch 56→64 px/s\n${formatBreakdown(rows)}\n`);

    expect(rows[0].ms).toBeLessThan(1);
    expect(rows[2].ms).toBeLessThan(5);
  });

  it("long audio resample scales with LOD base size", () => {
    const cases: Array<{ label: string; durationSec: number; pps: number }> = [
      { label: "1h", durationSec: 3600, pps: 800 },
      { label: "3h", durationSec: 10_800, pps: 800 },
    ];
    const px = 400;
    const rows: Timed[] = [];
    for (const c of cases) {
      const base = createSyntheticWaveformData(c.durationSec, c.pps);
      rows.push({
        label: `resample ${c.label} L3`,
        ms: medianMs(3, () => resampleWaveformForPxPerSec(base, px, c.durationSec)),
        detail: `base ${base.length} cols`,
      });
    }
    // eslint-disable-next-line no-console -- perf report
    console.info(`\n[waveform-zoom] long audio @ ${px}px/s\n${formatBreakdown(rows)}\n`);
    expect(rows[1].ms).toBeGreaterThan(rows[0].ms);
  });
});
