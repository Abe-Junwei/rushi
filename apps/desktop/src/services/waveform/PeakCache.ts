import type WaveformData from "waveform-data";
import { computeTimelineWidthPx } from "../../utils/pxPerSec";
import {
  loadWaveformDatFromPath,
  resampleWaveformForPxPerSec,
  resampleWaveformToWidth,
  waveformDataToWaveSurferPeaks,
  waveformDataToWaveSurferPeaksAsync,
  waveformDurationSec,
} from "./audiowaveformDat";
import { PEAK_LOD_LEVELS, pickPeakLodLevel } from "./peakLevels";

type LoadedPeakLevel = {
  level: number;
  pixelsPerSecond: number;
  data: WaveformData;
};

export type WaveSurferPeaksBundle = {
  peaks: Array<Float32Array | number[]>;
  duration: number;
};

export class PeakCache {
  readonly durationSec: number;
  readonly sampleRate: number;

  private static readonly RESAMPLE_CACHE_MAX = 16;

  private readonly levels: Map<number, WaveformData>;
  /** Key = `${lodLevel}:${targetWidthPx}` for a given peaks-load px/s bucket. */
  private readonly resampleCache = new Map<string, WaveSurferPeaksBundle>();
  private readonly resampleCacheOrder: string[] = [];

  private constructor(levels: LoadedPeakLevel[], durationSec: number, sampleRate: number) {
    this.durationSec = durationSec;
    this.sampleRate = sampleRate;
    this.levels = new Map(levels.map((l) => [l.level, l.data]));
  }

  static async fromLevelUrls(
    entries: Array<{ level: number; pixelsPerSecond: number; path: string }>,
  ): Promise<PeakCache | null> {
    if (entries.length === 0) return null;
    const loaded = await Promise.all(
      entries.map(async (entry) => ({
        level: entry.level,
        pixelsPerSecond: entry.pixelsPerSecond,
        data: await loadWaveformDatFromPath(entry.path),
      })),
    );
    const finest = loaded.reduce((a, b) => (a.pixelsPerSecond >= b.pixelsPerSecond ? a : b));
    return new PeakCache(loaded, waveformDurationSec(finest.data), finest.data.sample_rate);
  }

  /** Load additional LOD files into an existing cache (e.g. L2 after L0/L1 bootstrap). */
  async loadLevels(
    entries: Array<{ level: number; pixelsPerSecond: number; path: string }>,
  ): Promise<void> {
    const pending = entries.filter((entry) => !this.levels.has(entry.level));
    if (pending.length === 0) return;
    const loaded = await Promise.all(
      pending.map(async (entry) => ({
        level: entry.level,
        pixelsPerSecond: entry.pixelsPerSecond,
        data: await loadWaveformDatFromPath(entry.path),
      })),
    );
    for (const entry of loaded) {
      this.levels.set(entry.level, entry.data);
    }
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
    return this.buildWaveSurferPeaksBundleSync(pxPerSec, layoutMediaDurationSec);
  }

  async getWaveSurferPeaksAsync(
    pxPerSec: number,
    layoutMediaDurationSec?: number,
  ): Promise<WaveSurferPeaksBundle> {
    const base = this.pickBaseLevel(pxPerSec);
    if (!base) {
      throw new Error("PeakCache 无可用 LOD");
    }
    const layoutDur =
      layoutMediaDurationSec != null && layoutMediaDurationSec > 0
        ? layoutMediaDurationSec
        : this.durationSec;
    const targetWidthPx = Math.max(1, computeTimelineWidthPx(layoutDur, pxPerSec));
    const key = `${base.level}:${targetWidthPx}`;
    const cached = this.resampleCache.get(key);
    if (cached) {
      this.touchResampleKey(key);
      return cached;
    }

    const resampled = resampleWaveformForPxPerSec(base.data, pxPerSec, layoutDur);
    const bundle = {
      peaks: await waveformDataToWaveSurferPeaksAsync(resampled),
      duration: layoutDur,
    };
    return this.storeResample(key, bundle);
  }

  private buildWaveSurferPeaksBundleSync(
    pxPerSec: number,
    layoutMediaDurationSec?: number,
  ): WaveSurferPeaksBundle {
    const base = this.pickBaseLevel(pxPerSec);
    if (!base) {
      throw new Error("PeakCache 无可用 LOD");
    }
    const layoutDur =
      layoutMediaDurationSec != null && layoutMediaDurationSec > 0
        ? layoutMediaDurationSec
        : this.durationSec;
    const targetWidthPx = Math.max(1, computeTimelineWidthPx(layoutDur, pxPerSec));
    const key = `${base.level}:${targetWidthPx}`;
    const cached = this.resampleCache.get(key);
    if (cached) {
      this.touchResampleKey(key);
      return cached;
    }

    const resampled = resampleWaveformForPxPerSec(base.data, pxPerSec, layoutDur);
    const bundle = {
      peaks: waveformDataToWaveSurferPeaks(resampled),
      duration: layoutDur,
    };
    return this.storeResample(key, bundle);
  }

  private pickCoarsestLevelData(): WaveformData | null {
    for (const lod of PEAK_LOD_LEVELS) {
      const data = this.levels.get(lod.level);
      if (data) return data;
    }
    return null;
  }

  /** L0 resample for minimap strip (fixed overview width, no timeline floor). */
  getMinimapPeaks(overviewWidthPx: number, layoutMediaDurationSec?: number): WaveSurferPeaksBundle | null {
    const base = this.pickCoarsestLevelData();
    if (!base) return null;
    const layoutDur =
      layoutMediaDurationSec != null && layoutMediaDurationSec > 0
        ? layoutMediaDurationSec
        : this.durationSec;
    const widthPx = Math.max(1, Math.floor(overviewWidthPx));
    const resampled = resampleWaveformToWidth(base, widthPx);
    return {
      peaks: waveformDataToWaveSurferPeaks(resampled),
      duration: layoutDur,
    };
  }

  async getMinimapPeaksAsync(
    overviewWidthPx: number,
    layoutMediaDurationSec?: number,
  ): Promise<WaveSurferPeaksBundle | null> {
    try {
      const base = this.pickCoarsestLevelData();
      if (!base) return null;
      const layoutDur =
        layoutMediaDurationSec != null && layoutMediaDurationSec > 0
          ? layoutMediaDurationSec
          : this.durationSec;
      const widthPx = Math.max(1, Math.floor(overviewWidthPx));
      const resampled = resampleWaveformToWidth(base, widthPx);
      const peaks =
        resampled.length > 4_000
          ? await waveformDataToWaveSurferPeaksAsync(resampled)
          : waveformDataToWaveSurferPeaks(resampled);
      return { peaks, duration: layoutDur };
    } catch {
      return null;
    }
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
}
