import type WaveformData from "waveform-data";
import {
  loadWaveformDatFromUrl,
  resampleWaveformForPxPerSec,
  waveformDataToWaveSurferPeaks,
  waveformDurationSec,
} from "./audiowaveformDat";
import { PEAK_LOD_LEVELS, pickPeakLodLevel } from "./peakLevels";

export type PeakLodLevel = (typeof PEAK_LOD_LEVELS)[number];

export type LoadedPeakLevel = {
  level: number;
  pixelsPerSecond: number;
  data: WaveformData;
};

export type WaveSurferPeaksBundle = {
  peaks: number[][];
  duration: number;
};

export class PeakCache {
  readonly durationSec: number;
  readonly sampleRate: number;

  private readonly levels: Map<number, WaveformData>;
  private readonly resampleCache = new Map<number, WaveSurferPeaksBundle>();

  private constructor(levels: LoadedPeakLevel[], durationSec: number, sampleRate: number) {
    this.durationSec = durationSec;
    this.sampleRate = sampleRate;
    this.levels = new Map(levels.map((l) => [l.level, l.data]));
  }

  static async fromLevelUrls(
    entries: Array<{ level: number; pixelsPerSecond: number; url: string }>,
  ): Promise<PeakCache | null> {
    const loaded: LoadedPeakLevel[] = [];
    for (const entry of entries) {
      const data = await loadWaveformDatFromUrl(entry.url);
      loaded.push({
        level: entry.level,
        pixelsPerSecond: entry.pixelsPerSecond,
        data,
      });
    }
    if (loaded.length === 0) return null;
    const finest = loaded.reduce((a, b) => (a.pixelsPerSecond >= b.pixelsPerSecond ? a : b));
    return new PeakCache(loaded, waveformDurationSec(finest.data), finest.data.sample_rate);
  }

  hasLevel(level: number): boolean {
    return this.levels.has(level);
  }

  pickBaseLevel(pxPerSec: number): LoadedPeakLevel | null {
    const level = pickPeakLodLevel(pxPerSec);
    let data = this.levels.get(level);
    let pickedLevel = level;
    if (!data) {
      const entries = [...this.levels.entries()].sort((a, b) => b[0] - a[0]);
      const fallback = entries[0];
      if (!fallback) return null;
      pickedLevel = fallback[0];
      data = fallback[1];
    }
    const meta = PEAK_LOD_LEVELS.find((l) => l.level === pickedLevel);
    if (!meta || !data) return null;
    return { level: meta.level, pixelsPerSecond: meta.pixelsPerSecond, data };
  }

  getWaveSurferPeaks(pxPerSec: number): WaveSurferPeaksBundle {
    // 以 2 px/s 为粒度对 key 量化，减少相邻缩放值的缓存碎片
    const key = Math.round(pxPerSec / 2) * 2;
    const cached = this.resampleCache.get(key);
    if (cached) return cached;

    const base = this.pickBaseLevel(pxPerSec);
    if (!base) {
      throw new Error("PeakCache 无可用 LOD");
    }
    const resampled = resampleWaveformForPxPerSec(base.data, pxPerSec);
    const bundle = {
      peaks: waveformDataToWaveSurferPeaks(resampled),
      duration: this.durationSec,
    };
    this.resampleCache.set(key, bundle);
    return bundle;
  }

  /** Interleaved min/max floats for canvas draw at target px/s. */
  getInterleavedPeaks(pxPerSec: number): number[] {
    try {
      return this.getWaveSurferPeaks(pxPerSec).peaks[0] ?? [];
    } catch {
      const base = this.pickBaseLevel(pxPerSec);
      if (!base) return [];
      const resampled = resampleWaveformForPxPerSec(base.data, pxPerSec);
      return waveformDataToWaveSurferPeaks(resampled)[0] ?? [];
    }
  }
}
