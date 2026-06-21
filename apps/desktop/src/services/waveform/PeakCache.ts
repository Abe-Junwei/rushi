import type WaveformData from "waveform-data";
import { computeTimelineWidthPx } from "../../utils/pxPerSec";
import { quantizePxPerSecForPeaksLoad, quantizeTimelineWidthPx } from "../../utils/pxPerSecClamp";
import {
  loadWaveformDatFromPath,
  resampleWaveformForPxPerSec,
  resampleWaveformToWidth,
  waveformDataToWaveSurferPeaks,
  waveformDataToWaveSurferPeaksAsync,
  waveformDurationSec,
} from "./audiowaveformDat";
import {
  ByteBudgetLruMap,
  estimateWaveSurferPeaksBundleBytes,
  estimateWaveformLikeBytes,
} from "./peakCacheByteBudget";
import { PEAK_LOD_LEVELS, pickPeakLodLevel } from "./peakLevels";

type LoadedPeakLevel = {
  level: number;
  pixelsPerSecond: number;
  data: WaveformData;
};

type PeakLevelEntry = {
  level: number;
  pixelsPerSecond: number;
  path: string;
};

export type WaveSurferPeaksBundle = {
  peaks: Array<Float32Array | number[]>;
  duration: number;
};

export type PeakCacheOptions = {
  rawBudgetBytes?: number;
  resampleBudgetBytes?: number;
};

export class PeakCache {
  readonly durationSec: number;
  readonly sampleRate: number;

  private static readonly DEFAULT_RAW_BUDGET_BYTES = 96 * 1024 * 1024;
  private static readonly DEFAULT_RESAMPLE_BUDGET_BYTES = 64 * 1024 * 1024;

  private readonly knownLevels: Map<number, PeakLevelEntry>;
  private readonly levels: ByteBudgetLruMap<number, LoadedPeakLevel>;
  /** Key = `${lodLevel}:${quantizePxPerSec}:${quantizeTimelineWidthPx}` */
  private readonly resampleCache: ByteBudgetLruMap<string, WaveSurferPeaksBundle>;
  private readonly loadPromises = new Map<number, Promise<LoadedPeakLevel>>();

  private constructor(
    entries: PeakLevelEntry[],
    levels: LoadedPeakLevel[],
    durationSec: number,
    sampleRate: number,
    options: PeakCacheOptions = {},
  ) {
    this.durationSec = durationSec;
    this.sampleRate = sampleRate;
    this.knownLevels = new Map(entries.map((entry) => [entry.level, entry]));
    this.levels = new ByteBudgetLruMap(
      options.rawBudgetBytes ?? PeakCache.DEFAULT_RAW_BUDGET_BYTES,
    );
    this.resampleCache = new ByteBudgetLruMap(
      options.resampleBudgetBytes ?? PeakCache.DEFAULT_RESAMPLE_BUDGET_BYTES,
    );
    for (const level of levels) {
      this.storeLoadedLevel(level);
    }
  }

  static async fromLevelUrls(
    entries: PeakLevelEntry[],
    options?: PeakCacheOptions,
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
    return new PeakCache(
      entries,
      loaded,
      waveformDurationSec(finest.data),
      finest.data.sample_rate,
      options,
    );
  }

  registerLevels(entries: PeakLevelEntry[]): void {
    for (const entry of entries) {
      this.knownLevels.set(entry.level, entry);
    }
  }

  /** Load additional LOD files into an existing cache (e.g. L2 after L0/L1 bootstrap). */
  async loadLevels(entries: PeakLevelEntry[]): Promise<void> {
    this.registerLevels(entries);
    await Promise.all(entries.map((entry) => this.ensureLevel(entry.level)));
  }

  hasLevel(level: number): boolean {
    return this.levels.has(level);
  }

  async ensureLevelForPxPerSec(pxPerSec: number): Promise<LoadedPeakLevel> {
    return this.ensureLevel(this.resolveKnownLevelForPxPerSec(pxPerSec));
  }

  async ensureCoarsestLevel(): Promise<LoadedPeakLevel | null> {
    const level = this.resolveCoarsestKnownLevel();
    return level == null ? null : this.ensureLevel(level);
  }

  pickBaseLevel(pxPerSec: number): LoadedPeakLevel | null {
    let pickedLevel = this.resolveKnownLevelForPxPerSec(pxPerSec);
    let entry = this.levels.get(pickedLevel);
    if (!entry) {
      const fallback = [...this.levels.values()].sort((a, b) => b.level - a.level)[0];
      if (!fallback) return null;
      pickedLevel = fallback.level;
      entry = fallback;
    }
    return {
      level: pickedLevel,
      pixelsPerSecond: entry.pixelsPerSecond,
      data: entry.data,
    };
  }

  getWaveSurferPeaks(pxPerSec: number, layoutMediaDurationSec?: number): WaveSurferPeaksBundle {
    return this.buildWaveSurferPeaksBundleSync(pxPerSec, layoutMediaDurationSec);
  }

  async getWaveSurferPeaksAsync(
    pxPerSec: number,
    layoutMediaDurationSec?: number,
  ): Promise<WaveSurferPeaksBundle> {
    const base = await this.ensureLevelForPxPerSec(pxPerSec);
    const layoutDur =
      layoutMediaDurationSec != null && layoutMediaDurationSec > 0
        ? layoutMediaDurationSec
        : this.durationSec;
    const targetWidthPx = Math.max(1, computeTimelineWidthPx(layoutDur, pxPerSec));
    const key = this.buildResampleCacheKey(base.level, pxPerSec, targetWidthPx);
    const cached = this.resampleCache.get(key);
    if (cached) {
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
    const key = this.buildResampleCacheKey(base.level, pxPerSec, targetWidthPx);
    const cached = this.resampleCache.get(key);
    if (cached) {
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
      const data = this.levels.get(lod.level)?.data;
      if (data) {
        return data;
      }
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
      const loaded = await this.ensureCoarsestLevel();
      const base = loaded?.data ?? null;
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

  private buildResampleCacheKey(level: number, pxPerSec: number, targetWidthPx: number): string {
    return `${level}:${quantizePxPerSecForPeaksLoad(pxPerSec)}:${quantizeTimelineWidthPx(targetWidthPx)}`;
  }

  private storeResample(key: string, bundle: WaveSurferPeaksBundle): WaveSurferPeaksBundle {
    const existing = this.resampleCache.get(key);
    if (existing) {
      return existing;
    }
    const bytes = estimateWaveSurferPeaksBundleBytes(bundle.peaks);
    this.resampleCache.set(key, bundle, bytes);
    return bundle;
  }

  private resolveKnownLevelForPxPerSec(pxPerSec: number): number {
    const target = pickPeakLodLevel(pxPerSec);
    if (this.knownLevels.has(target)) return target;
    const levels = [...this.knownLevels.keys()].sort((a, b) => b - a);
    return levels[0] ?? target;
  }

  private resolveCoarsestKnownLevel(): number | null {
    return [...this.knownLevels.keys()].sort((a, b) => a - b)[0] ?? null;
  }

  private async ensureLevel(level: number): Promise<LoadedPeakLevel> {
    const cached = this.levels.get(level);
    if (cached) {
      return cached;
    }
    const existing = this.loadPromises.get(level);
    if (existing) return existing;
    const entry = this.knownLevels.get(level);
    if (!entry) {
      throw new Error(`PeakCache 缺少 LOD ${level}`);
    }
    const pending = loadWaveformDatFromPath(entry.path)
      .then((data) => {
        const loaded = { level: entry.level, pixelsPerSecond: entry.pixelsPerSecond, data };
        this.storeLoadedLevel(loaded);
        return loaded;
      })
      .finally(() => {
        this.loadPromises.delete(level);
      });
    this.loadPromises.set(level, pending);
    return pending;
  }

  private storeLoadedLevel(level: LoadedPeakLevel): void {
    const bytes = estimateWaveformLikeBytes(level.data);
    this.levels.set(level.level, level, bytes);
  }
}
