/** Coalesce tier-scroll-driven imperative paints into one rAF per frame. */

type TierScrollFrameSubscriber = () => void;

const subscribers = new Set<TierScrollFrameSubscriber>();
let frameRafId = 0;
let coalescedScrollLeftPx: number | null = null;
let coalescedAtMs = 0;
let forceNextTierScrollFrame = false;

export type TierViewportMetricsSnapshot = {
  scrollLeftPx: number;
  viewportWidthPx: number;
};

let scrollFrameActive = false;
let scrollFrameMetricsSnapshot: TierViewportMetricsSnapshot | null = null;
let metricsSupplier: (() => TierViewportMetricsSnapshot | null) | null = null;

export function isTierScrollFrameActive(): boolean {
  return scrollFrameActive;
}

export function registerTierScrollFrameMetricsSupplier(
  supplier: (() => TierViewportMetricsSnapshot | null) | null,
): void {
  metricsSupplier = supplier;
}

export function writeTierViewportMetricsDuringScrollFrame(snapshot: TierViewportMetricsSnapshot): void {
  scrollFrameMetricsSnapshot = snapshot;
}

export function readTierViewportMetricsDuringScrollFrame(): TierViewportMetricsSnapshot | null {
  return scrollFrameMetricsSnapshot;
}

export function clearTierViewportMetricsDuringScrollFrameForTests(): void {
  scrollFrameMetricsSnapshot = null;
  scrollFrameActive = false;
  metricsSupplier = null;
  coalescedScrollLeftPx = null;
  coalescedAtMs = 0;
  forceNextTierScrollFrame = false;
}

import {
  waveformScrollProfileBeginBurst,
} from "../services/waveform/waveformScrollProfile";

function runTierScrollFrame(): void {
  frameRafId = 0;
  scrollFrameActive = true;
  scrollFrameMetricsSnapshot = metricsSupplier?.() ?? null;
  const scrollLeftPx = scrollFrameMetricsSnapshot?.scrollLeftPx ?? null;
  const now = performance.now();
  const force = forceNextTierScrollFrame;
  forceNextTierScrollFrame = false;
  if (
    !force &&
    scrollLeftPx != null &&
    scrollLeftPx === coalescedScrollLeftPx &&
    now - coalescedAtMs < 12
  ) {
    scrollFrameActive = false;
    scrollFrameMetricsSnapshot = null;
    return;
  }
  coalescedScrollLeftPx = scrollLeftPx;
  coalescedAtMs = now;
  waveformScrollProfileBeginBurst();
  for (const fn of subscribers) {
    fn();
  }
  scrollFrameMetricsSnapshot = null;
  scrollFrameActive = false;
}

/** Schedule one coalesced scroll frame for viewport chrome paints. */
export function scheduleTierScrollFrame(): void {
  if (frameRafId !== 0) return;
  frameRafId = requestAnimationFrame(runTierScrollFrame);
}

export function subscribeTierScrollFrame(fn: TierScrollFrameSubscriber): () => void {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}

/** @deprecated Prefer {@link subscribeTierScrollFrame}. */
export function registerWaveformSegmentBandPaintScheduler(fn: TierScrollFrameSubscriber): () => void {
  return subscribeTierScrollFrame(fn);
}

export type WaveformSegmentBandPaintOptions = {
  /** Bypass 12ms scroll-left coalesce (selection chrome, same-frame flush). */
  force?: boolean;
};

/** Request segment-band / scroll-chrome repaint (coalesced). */
export function requestWaveformSegmentBandPaint(options?: WaveformSegmentBandPaintOptions): void {
  if (options?.force) forceNextTierScrollFrame = true;
  scheduleTierScrollFrame();
}

/**
 * Run subscribers synchronously now, cancelling any pending rAF.
 * Use when an imperative scroll write must repaint sticky chrome in the SAME frame
 * (e.g. wheel-driven scroll), so sticky layers don't trail the natively-scrolled waveform by 1 frame.
 */
export function flushTierScrollFrame(options?: WaveformSegmentBandPaintOptions): void {
  if (options?.force) forceNextTierScrollFrame = true;
  if (frameRafId !== 0) {
    cancelAnimationFrame(frameRafId);
    frameRafId = 0;
  }
  runTierScrollFrame();
}

/** Test-only: flush pending frame synchronously. */
export function flushTierScrollFrameForTests(): void {
  flushTierScrollFrame();
}

/** Test-only: clear subscribers and pending rAF. */
export function resetTierScrollFrameCoordinatorForTests(): void {
  if (frameRafId !== 0) {
    cancelAnimationFrame(frameRafId);
    frameRafId = 0;
  }
  subscribers.clear();
  scrollFrameMetricsSnapshot = null;
  metricsSupplier = null;
  coalescedScrollLeftPx = null;
  coalescedAtMs = 0;
  forceNextTierScrollFrame = false;
}
