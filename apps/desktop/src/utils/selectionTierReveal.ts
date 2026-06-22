import { computeTimelineWidthPx } from "./segmentLayout";
import { computeViewportFitScrollPx } from "./pxPerSecFit";

export type TierRevealScrollInput = {
  seg: { start_sec: number; end_sec: number };
  scrollLeftPx: number;
  viewportWidthPx: number;
  pxPerSec: number;
  durationSec: number;
};

/** Absolute delta between current tier scroll and reveal target. Infinity when tier not ready. */
export function tierRevealScrollDeltaPx(input: TierRevealScrollInput): number {
  const w = input.viewportWidthPx;
  if (w <= 0 || input.durationSec < 0.5) return Number.POSITIVE_INFINITY;
  const tw = computeTimelineWidthPx(input.durationSec, input.pxPerSec);
  const target = computeViewportFitScrollPx({
    intent: { startSec: input.seg.start_sec, endSec: input.seg.end_sec },
    viewportWidthPx: w,
    timelineWidthPx: tw,
    durationSec: input.durationSec,
  });
  return Math.abs(target - input.scrollLeftPx);
}

export function shouldSkipTierRevealForSegment(
  input: TierRevealScrollInput,
  tolerancePx = 1,
): boolean {
  return tierRevealScrollDeltaPx(input) < tolerancePx;
}
