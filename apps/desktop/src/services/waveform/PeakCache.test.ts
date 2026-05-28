import { beforeEach, describe, expect, it, vi } from "vitest";

const resampleMock = vi.fn((data: unknown) => data);
const toPeaksMock = vi.fn((_data?: unknown) => [[0, 0.5, -0.1, 0.2]]);

vi.mock("./audiowaveformDat", () => ({
  loadWaveformDatFromUrl: vi.fn(async () => ({ sample_rate: 44100 })),
  resampleWaveformForPxPerSec: (data: unknown, _px: unknown) => resampleMock(data),
  waveformDataToWaveSurferPeaks: (data: unknown) => toPeaksMock(data),
  waveformDurationSec: () => 12,
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
});
