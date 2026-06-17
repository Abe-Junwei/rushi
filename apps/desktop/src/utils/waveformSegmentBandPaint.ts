/** Imperative repaint hook for viewport-sized segment band canvas (pairs with tier scroll mirror). */

let schedulePaint: (() => void) | null = null;

export function registerWaveformSegmentBandPaintScheduler(fn: () => void): () => void {
  schedulePaint = fn;
  return () => {
    if (schedulePaint === fn) schedulePaint = null;
  };
}

export function requestWaveformSegmentBandPaint(): void {
  schedulePaint?.();
}
