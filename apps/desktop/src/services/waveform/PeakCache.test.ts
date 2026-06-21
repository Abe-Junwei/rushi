import { beforeEach, describe, expect, it, vi } from "vitest";

const loadMock = vi.fn((path: string) =>
  Promise.resolve({
    sample_rate: 44100,
    length: path.includes("l3") ? 3_000 : path.includes("l1") ? 1_000 : 600,
    channels: 1,
    path,
  }),
);
const resampleMock = vi.fn((data: unknown) => data);
const toPeaksMock = vi.fn(
  (_data?: unknown): Array<Float32Array | number[]> => [[0, 0.5, -0.1, 0.2]],
);

vi.mock("./audiowaveformDat", () => ({
  loadWaveformDatFromPath: (path: string) => loadMock(path),
  resampleWaveformForPxPerSec: (data: unknown) => resampleMock(data),
  resampleWaveformToWidth: (data: unknown) => resampleMock(data),
  waveformDataToWaveSurferPeaks: (data: unknown) => toPeaksMock(data),
  waveformDataToWaveSurferPeaksAsync: (data: unknown) => Promise.resolve(toPeaksMock(data)),
  waveformDurationSec: () => 600,
}));

import { PeakCache } from "./PeakCache";

describe("PeakCache", () => {
  beforeEach(() => {
    loadMock.mockClear();
    resampleMock.mockClear();
    toPeaksMock.mockClear();
    resampleMock.mockImplementation((d) => d);
    toPeaksMock.mockImplementation((_data?: unknown) => [[0, 0.5, -0.1, 0.2]]);
  });

  it("returns distinct instances per fromLevelUrls call", async () => {
    const cacheA = await PeakCache.fromLevelUrls([
      { level: 1, pixelsPerSecond: 20, path: "/tmp/a.dat" },
    ]);
    const cacheB = await PeakCache.fromLevelUrls([
      { level: 1, pixelsPerSecond: 20, path: "/tmp/b.dat" },
    ]);
    expect(cacheA).not.toBeNull();
    expect(cacheB).not.toBeNull();
    if (!cacheA || !cacheB) return;
    expect(cacheA).not.toBe(cacheB);
  });

  it("uses distinct resample cache entries across quantize buckets (S10)", async () => {
    const cache = await PeakCache.fromLevelUrls([
      { level: 1, pixelsPerSecond: 20, path: "/tmp/s10.dat" },
    ]);
    if (!cache) throw new Error("cache missing");

    resampleMock.mockClear();
    cache.getWaveSurferPeaks(56);
    cache.getWaveSurferPeaks(200);
    expect(resampleMock).toHaveBeenCalledTimes(2);
  });

  it("memoizes resample results per pxPerSec", async () => {
    const cache = await PeakCache.fromLevelUrls([
      { level: 1, pixelsPerSecond: 20, path: "/tmp/x.dat" },
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
      { level: 1, pixelsPerSecond: 20, path: "/tmp/x.dat" },
    ]);
    expect(cache).not.toBeNull();
    if (!cache) return;

    const bundle = cache.getWaveSurferPeaks(56, 610);
    expect(bundle.duration).toBe(610);
  });

  it("evicts oldest resample entries beyond byte budget", async () => {
    const cache = await PeakCache.fromLevelUrls([
      { level: 0, pixelsPerSecond: 2, path: "asset://l0.dat" },
    ], { resampleBudgetBytes: 128 });
    expect(cache).not.toBeNull();
    if (!cache) return;
    toPeaksMock.mockImplementation(() => [new Float32Array(16)]);

    for (let px = 1; px <= 3; px += 1) {
      cache.getWaveSurferPeaks(px);
    }
    expect(resampleMock).toHaveBeenCalledTimes(3);

    resampleMock.mockClear();
    cache.getWaveSurferPeaks(1);
    expect(resampleMock).toHaveBeenCalledTimes(1);

    resampleMock.mockClear();
    cache.getWaveSurferPeaks(3);
    expect(resampleMock).toHaveBeenCalledTimes(0);
  });

  it("registers deferred LOD paths without loading them until needed", async () => {
    const cache = await PeakCache.fromLevelUrls([
      { level: 0, pixelsPerSecond: 2, path: "asset://l0.dat" },
    ]);
    expect(cache).not.toBeNull();
    if (!cache) return;
    loadMock.mockClear();

    cache.registerLevels([{ level: 3, pixelsPerSecond: 800, path: "asset://l3.dat" }]);
    expect(cache.hasLevel(3)).toBe(false);
    await cache.getWaveSurferPeaksAsync(400);
    expect(loadMock).toHaveBeenCalledTimes(1);
    expect(loadMock).toHaveBeenCalledWith("asset://l3.dat");
    expect(cache.hasLevel(3)).toBe(true);
  });

  it("deduplicates concurrent LOD loads", async () => {
    const cache = await PeakCache.fromLevelUrls([
      { level: 0, pixelsPerSecond: 2, path: "asset://l0.dat" },
    ]);
    expect(cache).not.toBeNull();
    if (!cache) return;
    cache.registerLevels([{ level: 3, pixelsPerSecond: 800, path: "asset://l3.dat" }]);
    loadMock.mockClear();

    await Promise.all([cache.ensureLevelForPxPerSec(400), cache.ensureLevelForPxPerSec(480)]);
    expect(loadMock).toHaveBeenCalledTimes(1);
  });

  it("evicts raw LODs by byte budget while keeping the requested level", async () => {
    const cache = await PeakCache.fromLevelUrls(
      [{ level: 0, pixelsPerSecond: 2, path: "asset://l0.dat" }],
      { rawBudgetBytes: 5_000 },
    );
    expect(cache).not.toBeNull();
    if (!cache) return;

    cache.registerLevels([{ level: 3, pixelsPerSecond: 800, path: "asset://l3.dat" }]);
    await cache.ensureLevelForPxPerSec(400);
    expect(cache.hasLevel(3)).toBe(true);
    expect(cache.hasLevel(0)).toBe(false);
  });

  it("does not reuse resample cache across px/s that map to different target widths", async () => {
    const cache = await PeakCache.fromLevelUrls([
      { level: 0, pixelsPerSecond: 2, path: "asset://l0.dat" },
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

  it("does not share resample cache for same px/s with different layout durations", async () => {
    const cache = await PeakCache.fromLevelUrls([
      { level: 0, pixelsPerSecond: 2, path: "asset://l0.dat" },
    ]);
    expect(cache).not.toBeNull();
    if (!cache) return;

    resampleMock.mockClear();
    cache.getWaveSurferPeaks(40, 600);
    cache.getWaveSurferPeaks(40, 1200);
    expect(resampleMock).toHaveBeenCalledTimes(2);
  });

  it("shares resample cache for adjacent timeline widths within the same bucket", async () => {
    const cache = await PeakCache.fromLevelUrls([
      { level: 0, pixelsPerSecond: 2, path: "asset://l0.dat" },
    ]);
    expect(cache).not.toBeNull();
    if (!cache) return;

    resampleMock.mockClear();
    const a = cache.getWaveSurferPeaks(40, 600);
    const b = cache.getWaveSurferPeaks(40, 600.025);
    expect(a).toBe(b);
    expect(resampleMock).toHaveBeenCalledTimes(1);
  });

  it("getMinimapPeaks uses coarsest loaded LOD when L0 is absent", async () => {
    const cache = await PeakCache.fromLevelUrls([
      { level: 1, pixelsPerSecond: 20, path: "asset://l1.dat" },
    ]);
    expect(cache).not.toBeNull();
    if (!cache) return;

    const bundle = cache.getMinimapPeaks(400, 600);
    expect(bundle).not.toBeNull();
    expect(bundle?.duration).toBe(600);
    expect(resampleMock).toHaveBeenCalled();
    expect(toPeaksMock).toHaveBeenCalled();
  });

  it("getMinimapPeaksAsync resolves minimap peaks", async () => {
    const cache = await PeakCache.fromLevelUrls([
      { level: 0, pixelsPerSecond: 2, path: "asset://l0.dat" },
    ]);
    expect(cache).not.toBeNull();
    if (!cache) return;

    const bundle = await cache.getMinimapPeaksAsync(320, 600);
    expect(bundle).not.toBeNull();
    expect(bundle?.peaks[0]?.length).toBeGreaterThan(0);
  });
});
