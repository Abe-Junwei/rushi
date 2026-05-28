import { beforeEach, describe, expect, it, vi } from "vitest";

const resampleMock = vi.fn((data: unknown) => data);
const toPeaksMock = vi.fn((_data?: unknown) => [[0, 0.5, -0.1, 0.2]]);

vi.mock("./audiowaveformDat", () => ({
  loadWaveformDatFromUrl: vi.fn(async () => ({ sample_rate: 44100 })),
  resampleWaveformForPxPerSec: (data: unknown, _px: unknown) => resampleMock(data),
  waveformDataToWaveSurferPeaks: (data: unknown) => toPeaksMock(data),
  waveformDurationSec: () => 600,
}));

import { PeakCache } from "./PeakCache";

describe("PeakCache", () => {
  beforeEach(() => {
    resampleMock.mockClear();
    toPeaksMock.mockClear();
    resampleMock.mockImplementation((d) => d);
  });

  it("memoizes resample results per pxPerSec", async () => {
    const cache = await PeakCache.fromLevelUrls([
      { level: 1, pixelsPerSecond: 20, url: "asset://x.dat" },
    ]);
    expect(cache).not.toBeNull();
    if (!cache) return;

    const a = cache.getWaveSurferPeaks(56);
    const b = cache.getWaveSurferPeaks(56);
    expect(a).toBe(b);
    expect(resampleMock).toHaveBeenCalledTimes(1);

    cache.getWaveSurferPeaks(80);
    expect(resampleMock).toHaveBeenCalledTimes(2);
  });

  it("does not reuse resample cache across px/s that map to different target widths", async () => {
    const cache = await PeakCache.fromLevelUrls([
      { level: 0, pixelsPerSecond: 2, url: "asset://l0.dat" },
    ]);
    expect(cache).not.toBeNull();
    if (!cache) return;

    // Simulate different column counts per resample call.
    let call = 0;
    resampleMock.mockImplementation((d: unknown) => {
      call += 1;
      return { ...(d as object), _call: call };
    });
    toPeaksMock.mockImplementation((data?: unknown) => {
      const callNum = (data as { _call?: number } | undefined)?._call ?? 1;
      return [new Array(callNum * 4).fill(0)];
    });

    const low = cache.getWaveSurferPeaks(0.05);
    const mid = cache.getWaveSurferPeaks(1);
    expect(low).not.toBe(mid);
    expect(resampleMock).toHaveBeenCalledTimes(2);
    expect(low.peaks[0]?.length).not.toBe(mid.peaks[0]?.length);
  });
});
