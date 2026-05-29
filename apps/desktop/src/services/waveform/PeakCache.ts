import type WaveformData from "waveform-data";
import { computeTimelineWidthPx } from "../../utils/pxPerSec";
import {
  loadWaveformDatFromUrl,
  resampleWaveformForPxPerSec,
  resampleWaveformToWidth,
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

  private static readonly RESAMPLE_CACHE_MAX = 8;

  private readonly levels: Map<number, WaveformData>;
  /** Key = `${lodLevel}:${targetWidthPx}` — avoids px/s rounding collisions at low zoom. */
  private readonly resampleCache = new Map<string, WaveSurferPeaksBundle>();
  private readonly resampleCacheOrder: string[] = [];

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

  getWaveSurferPeaks(pxPerSec: number, layoutMediaDurationSec?: number): WaveSurferPeaksBundle {
    const base = this.pickBaseLevel(pxPerSec);
    if (!base) {
      throw new Error("PeakCache 无可用 LOD");
    }
    const layoutDur =
      layoutMediaDurationSec != null && layoutMediaDurationSec > 0
        ? layoutMediaDurationSec
        : this.durationSec;
    const targetWidthPx = Math.max(1, computeTimelineWidthPx(layoutDur, pxPerSec));
    const key = `${base.level}:${targetWidthPx}:${pxPerSec}`;
    const cached = this.resampleCache.get(key);
    if (cached) {
      this.touchResampleKey(key);
      return cached;
    }

    const resampled = resampleWaveformForPxPerSec(base.data, pxPerSec, layoutDur);
    const bundle = {
      peaks: waveformDataToWaveSurferPeaks(resampled),
      duration: this.durationSec,
    };
    return this.storeResample(key, bundle);
  }

  private storeResample(key: string, bundle: WaveSurferPeaksBundle): WaveSurferPeaksBundle {
    const existing = this.resampleCache.get(key);
    if (existing) {
      this.touchResampleKey(key);
      return existing;
    }
    this.resampleCache.set(key, bundle);
    this.resampleCacheOrder.push(key);
    while (this.resampleCacheOrder.length > PeakCache.RESAMPLE_CACHE_MAX) {
      const oldest = this.resampleCacheOrder.shift();
      if (oldest) this.resampleCache.delete(oldest);
    }
    return bundle;
  }

  private touchResampleKey(key: string): void {
    const idx = this.resampleCacheOrder.indexOf(key);
    if (idx >= 0) {
      this.resampleCacheOrder.splice(idx, 1);
      this.resampleCacheOrder.push(key);
    }
  }

  /** Interleaved min/max floats for canvas draw at target px/s. */
  getInterleavedPeaks(pxPerSec: number, layoutMediaDurationSec?: number): number[] {
    return this.getWaveSurferPeaks(pxPerSec, layoutMediaDurationSec).peaks[0] ?? [];
  }

  /** Overview-specific resample: target width = overview container width,
   *  bypassing `computeTimelineWidthPx` and its 320 px floor.
   */
  getInterleavedPeaksForOverview(
    overviewWidthPx: number,
    overviewPxPerSec: number,
    layoutMediaDurationSec?: number,
  ): number[] {
    const base = this.pickBaseLevel(overviewPxPerSec);
    if (!base) {
      throw new Error("PeakCache 无可用 LOD");
    }
    const layoutDur =
      layoutMediaDurationSec != null && layoutMediaDurationSec > 0
        ? layoutMediaDurationSec
        : this.durationSec;
    const w = Math.max(1, Math.floor(overviewWidthPx));
    const key = `ov:${base.level}:${w}:${Math.round(layoutDur * 100)}`;
    const cached = this.resampleCache.get(key);
    if (cached) {
      this.touchResampleKey(key);
      return cached.peaks[0] ?? [];
    }

    const resampled = resampleWaveformToWidth(base.data, w);
    const bundle = {
      peaks: waveformDataToWaveSurferPeaks(resampled),
      duration: this.durationSec,
    };
    this.storeResample(key, bundle);
    return bundle.peaks[0] ?? [];
  }
}
