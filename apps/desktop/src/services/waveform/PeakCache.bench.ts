import { bench, describe, vi } from "vitest";
import { PeakCache } from "./PeakCache";

function mockWaveformData(length: number, durationSec: number, sampleRate = 44100) {
  const minSamples = new Int16Array(length);
  const maxSamples = new Int16Array(length);
  for (let i = 0; i < length; i++) {
    minSamples[i] = -8000;
    maxSamples[i] = 8000;
  }
  return {
    length,
    duration: durationSec,
    sample_rate: sampleRate,
    channel: () => ({
      min_sample: (i: number) => minSamples[i] ?? 0,
      max_sample: (i: number) => maxSamples[i] ?? 0,
    }),
    resample: ({ width }: { width: number }) => mockWaveformData(width, durationSec, sampleRate),
  } as unknown as import("waveform-data").default;
}

vi.mock("./audiowaveformDat", () => ({
  loadWaveformDatFromUrl: () => Promise.resolve(mockWaveformData(2000, 600, 44100)),
  resampleWaveformForPxPerSec: (data: unknown) => data,
  waveformDataToWaveSurferPeaks: (data: { length: number }) => {
    const peaks = new Array<number>(data.length * 2);
    for (let i = 0; i < data.length; i++) {
      peaks[i * 2] = -0.5;
      peaks[i * 2 + 1] = 0.5;
    }
    return [peaks];
  },
  waveformDurationSec: (data: { duration: number }) => data.duration,
}));

async function makeCache(): Promise<PeakCache> {
  const cache = await PeakCache.fromLevelUrls([
    { level: 0, pixelsPerSecond: 2, url: "asset://l0.dat" },
  ]);
  if (!cache) throw new Error("mock cache creation failed");
  return cache;
}

describe("PeakCache resample LRU", () => {
  bench("sequential 10 px/s values", async () => {
    const cache = await makeCache();
    for (let px = 1; px <= 10; px += 1) {
      cache.getWaveSurferPeaks(px);
    }
  });

  bench("random access 10 values (all cached)", async () => {
    const cache = await makeCache();
    for (let px = 1; px <= 10; px += 1) cache.getWaveSurferPeaks(px);
    for (let i = 0; i < 50; i++) {
      cache.getWaveSurferPeaks((i % 10) + 1);
    }
  });
});
