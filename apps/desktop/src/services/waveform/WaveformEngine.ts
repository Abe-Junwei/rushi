import type { PeakCache, WaveSurferPeaksBundle } from "./PeakCache";
import { WaveformViewport, type WaveformViewportState } from "./WaveformViewport";

export type TimeListener = (timeSec: number) => void;

/** Facade over peaks + viewport; drawing backend (WS / Canvas) plugs in via `getPeaksForRender`. */
export class WaveformEngine {
  readonly viewport = new WaveformViewport();

  private peakCache: PeakCache | null = null;
  private timeSec = 0;
  private timeListeners = new Set<TimeListener>();

  setPeakCache(cache: PeakCache | null): void {
    this.peakCache = cache;
    if (cache) {
      this.viewport.patch({ durationSec: cache.durationSec });
    }
  }

  getPeakCache(): PeakCache | null {
    return this.peakCache;
  }

  setPxPerSec(pxPerSec: number): void {
    this.viewport.patch({ pxPerSec });
  }

  setScrollLeftPx(scrollLeftPx: number): void {
    this.viewport.patch({ scrollLeftPx });
  }

  setClientWidthPx(clientWidthPx: number): void {
    this.viewport.patch({ clientWidthPx });
  }

  setTimeSec(timeSec: number): void {
    if (this.timeSec === timeSec) return;
    this.timeSec = timeSec;
    for (const listener of this.timeListeners) {
      listener(timeSec);
    }
  }

  subscribeTime(listener: TimeListener): () => void {
    this.timeListeners.add(listener);
    listener(this.timeSec);
    return () => {
      this.timeListeners.delete(listener);
    };
  }

  subscribeViewport(listener: (state: WaveformViewportState) => void): () => void {
    return this.viewport.subscribe(listener);
  }

  getPeaksForRender(pxPerSec?: number): WaveSurferPeaksBundle | null {
    if (!this.peakCache) return null;
    const pps = pxPerSec ?? this.viewport.getSnapshot().pxPerSec;
    return this.peakCache.getWaveSurferPeaks(pps);
  }
}
