/** Coalesce tier-scroll-driven imperative paints into one rAF per frame. */

type TierScrollFrameSubscriber = () => void;

const subscribers = new Set<TierScrollFrameSubscriber>();
let frameRafId = 0;

function runTierScrollFrame(): void {
  frameRafId = 0;
  for (const fn of subscribers) {
    fn();
  }
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

/** Request segment-band / scroll-chrome repaint (coalesced). */
export function requestWaveformSegmentBandPaint(): void {
  scheduleTierScrollFrame();
}

/**
 * Run subscribers synchronously now, cancelling any pending rAF.
 * Use when an imperative scroll write must repaint sticky chrome in the SAME frame
 * (e.g. wheel-driven scroll), so sticky layers don't trail the natively-scrolled waveform by 1 frame.
 */
export function flushTierScrollFrame(): void {
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
}
