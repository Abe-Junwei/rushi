import type { PeakCache } from "./PeakCache";

/** Peak identity for tile generation / draw signatures (file switch safety). */
export function peakCacheIdentity(cache: PeakCache): string {
  return `${cache.durationSec}|${cache.sampleRate}`;
}

/** Pure draw-skip signature (unit-tested). Includes layout width + media duration. */
export function waveformTileDrawSignature(input: {
  generation: number;
  leftPx: number;
  widthPx: number;
  heightPx: number;
  layoutTimelineWidthPx: number;
  drawTimelineWidthPx: number;
  mediaDurationSec: number;
  dpr: number;
  drawPxPerSec: number;
  peakCache: PeakCache;
}): string {
  return [
    input.generation,
    input.leftPx,
    input.widthPx,
    input.heightPx,
    input.drawTimelineWidthPx,
    input.layoutTimelineWidthPx,
    input.mediaDurationSec,
    input.dpr,
    input.drawPxPerSec,
    peakCacheIdentity(input.peakCache),
  ].join("|");
}
