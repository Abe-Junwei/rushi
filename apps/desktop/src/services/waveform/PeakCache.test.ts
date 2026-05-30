import { beforeEach, describe, expect, it, vi } from "vitest";

const resampleMock = vi.fn((data: unknown) => data);
const toPeaksMock = vi.fn((_data?: unknown) => [[0, 0.5, -0.1, 0.2]]);

vi.mock("./audiowaveformDat", () => ({
  loadWaveformDatFromUrl: vi.fn(() => Promise.resolve({ sample_rate: 44100 })),
  resampleWaveformForPxPerSec: (data: unknown) => resampleMock(data),
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

  it("returns distinct instances per fromLevelUrls call", async () => {
    const cacheA = await PeakCache.fromLevelUrls([
      { level: 1, pixelsPerSecond: 20, url: "asset://a.dat" },
    ]);
    const cacheB = await PeakCache.fromLevelUrls([
      { level: 1, pixelsPerSecond: 20, url: "asset://b.dat" },
    ]);
    expect(cacheA).not.toBeNull();
    expect(cacheB).not.toBeNull();
    if (!cacheA || !cacheB) return;
    expect(cacheA).not.toBe(cacheB);
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

  it("uses layout duration in the returned bundle", async () => {
    const cache = await PeakCache.fromLevelUrls([
      { level: 1, pixelsPerSecond: 20, url: "asset://x.dat" },
    ]);
    expect(cache).not.toBeNull();
    if (!cache) return;

    const bundle = cache.getWaveSurferPeaks(56, 610);
    expect(bundle.duration).toBe(610);
  });

  it("evicts oldest resample entries beyond LRU cap", async () => {
    const cache = await PeakCache.fromLevelUrls([
      { level: 0, pixelsPerSecond: 2, url: "asset://l0.dat" },
    ]);
    expect(cache).not.toBeNull();
    if (!cache) return;

    for (let px = 1; px <= 18; px += 1) {
      cache.getWaveSurferPeaks(px);
    }
    expect(resampleMock).toHaveBeenCalledTimes(18);

    resampleMock.mockClear();
    cache.getWaveSurferPeaks(2);
    expect(resampleMock).toHaveBeenCalledTimes(1);

    resampleMock.mockClear();
    cache.getWaveSurferPeaks(18);
    expect(resampleMock).toHaveBeenCalledTimes(0);
  });

  it("does not reuse resample cache across px/s that map to different target widths", async () => {
    const cache = await PeakCache.fromLevelUrls([
      { level: 0, pixelsPerSecond: 2, url: "asset://l0.dat" },
    ]);
    expect(cache).not.toBeNull();
    if (!cache) return;

    let call = 0;
    resampleMock.mockImplementation((d: unknown) => {
      call += 1;
      return { ...(d as object), _call: call };
    });
    toPeaksMock.mockImplementation((data?: unknown) => {
      const callNum = (data as { _call?: number } | undefined)?._call ?? 1;
      return [new Array<number>(callNum * 4).fill(0)];
    });

    const low = cache.getWaveSurferPeaks(0.05);
    const mid = cache.getWaveSurferPeaks(1);
    expect(low).not.toBe(mid);
    expect(resampleMock).toHaveBeenCalledTimes(2);
    expect(low.peaks[0]?.length).not.toBe(mid.peaks[0]?.length);
  });
});
