import type { WaveformZoomSliderRange } from "./pxPerSec";
import { clampPxPerSecInSliderRange } from "./pxPerSec";
import { isPxPerSecBelowSliderMin } from "./waveformZoomBarState";

/** +/- 与键盘 zoom：显著低于滑块下限时 snap 到 min，否则按比例步进。 */
export function computeZoomInPxPerSec(
  pxPerSec: number,
  range: WaveformZoomSliderRange,
): number {
  if (isPxPerSecBelowSliderMin(pxPerSec, range.minPxPerSec)) {
    return range.minPxPerSec;
  }
  return clampPxPerSecInSliderRange(pxPerSec * 1.12, range);
}

export function computeZoomOutPxPerSec(
  pxPerSec: number,
  range: WaveformZoomSliderRange,
): number {
  if (isPxPerSecBelowSliderMin(pxPerSec, range.minPxPerSec)) {
    return range.minPxPerSec;
  }
  return clampPxPerSecInSliderRange(pxPerSec / 1.12, range);
}

export function pxPerSecToSliderPos(pxPerSec: number, range: WaveformZoomSliderRange): number {
  const { minPxPerSec: lo, maxPxPerSec: hi } = range;
  const c = clampPxPerSecInSliderRange(pxPerSec, range);
  if (hi <= lo) return 0;
  return Math.round((Math.log(c / lo) / Math.log(hi / lo)) * 1000);
}

export function sliderPosToPxPerSec(pos: number, range: WaveformZoomSliderRange): number {
  const { minPxPerSec: lo, maxPxPerSec: hi } = range;
  const t = Math.min(1000, Math.max(0, pos));
  if (hi <= lo) return lo;
  return clampPxPerSecInSliderRange(lo * (hi / lo) ** (t / 1000), range);
}
