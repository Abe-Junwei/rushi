import { describe, expect, it, vi } from "vitest";
import {
  exportMinimapPeaksFromWaveSurfer,
  interleaveExportPeaksChannel,
  resolveMinimapPeaksForDraw,
} from "./minimapPeaksSource";
import type { PeakCache } from "./PeakCache";

describe("interleaveExportPeaksChannel", () => {
  it("returns null for empty channel", () => {
    expect(interleaveExportPeaksChannel(undefined)).toBeNull();
    expect(interleaveExportPeaksChannel([])).toBeNull();
  });

  it("interleaves signed min/max pairs", () => {
    expect(Array.from(interleaveExportPeaksChannel([0.5, -0.25])!)).toEqual([
      -0.5, 0.5, -0.25, 0.25,
    ]);
  });
});

describe("exportMinimapPeaksFromWaveSurfer", () => {
  it("exports and interleaves peaks from WaveSurfer", () => {
    const ws = {
      exportPeaks: vi.fn(() => [[0.4, 0.8]]),
    };
    const peaks = exportMinimapPeaksFromWaveSurfer(ws as never, 320);
    expect(ws.exportPeaks).toHaveBeenCalledWith({ channels: 1, maxLength: 320, precision: 4 });
    expect(peaks).not.toBeNull();
    expect(peaks!.length).toBe(4);
    expect(peaks![0]).toBeCloseTo(-0.4);
    expect(peaks![1]).toBeCloseTo(0.4);
    expect(peaks![2]).toBeCloseTo(-0.8);
    expect(peaks![3]).toBeCloseTo(0.8);
  });

  it("returns null when export throws", () => {
    const ws = { exportPeaks: vi.fn(() => { throw new Error("fail"); }) };
    expect(exportMinimapPeaksFromWaveSurfer(ws as never, 100)).toBeNull();
  });
});

describe("resolveMinimapPeaksForDraw", () => {
  it("prefers WaveSurfer export when available", async () => {
    const exportPeaks = new Float32Array([-0.2, 0.2, -0.5, 0.5]);
    const peakCache = {
      getMinimapPeaks: vi.fn(() => ({ peaks: [new Float32Array([0, 1])], duration: 60 })),
      getMinimapPeaksAsync: vi.fn(),
    } as unknown as PeakCache;

    const result = await resolveMinimapPeaksForDraw({
      peakCache,
      overviewWidthPx: 200,
      layoutDurationSec: 60,
      exportFromWaveSurfer: () => exportPeaks,
    });

    expect(result).toBe(exportPeaks);
    expect(peakCache.getMinimapPeaks).not.toHaveBeenCalled();
  });

  it("falls back to peak cache when export is empty", async () => {
    const cachePeaks = new Float32Array([-0.1, 0.1, -0.3, 0.3]);
    const peakCache = {
      getMinimapPeaks: vi.fn(() => ({ peaks: [cachePeaks], duration: 120 })),
      getMinimapPeaksAsync: vi.fn(),
    } as unknown as PeakCache;

    const result = await resolveMinimapPeaksForDraw({
      peakCache,
      overviewWidthPx: 240,
      layoutDurationSec: 120,
      exportFromWaveSurfer: () => null,
    });

    expect(result).toBe(cachePeaks);
  });

  it("uses async peak cache when sync path is too short", async () => {
    const asyncPeaks = new Float32Array([-0.4, 0.4]);
    const peakCache = {
      getMinimapPeaks: vi.fn(() => null),
      getMinimapPeaksAsync: vi.fn(() => Promise.resolve({ peaks: [asyncPeaks], duration: 90 })),
    } as unknown as PeakCache;

    const result = await resolveMinimapPeaksForDraw({
      peakCache,
      overviewWidthPx: 180,
      layoutDurationSec: 90,
      exportFromWaveSurfer: () => null,
    });

    expect(result).toBe(asyncPeaks);
    expect(peakCache.getMinimapPeaksAsync).toHaveBeenCalledWith(180, 90);
  });
});
