const STRETCH_EPSILON = 0.001;

/** Imperatively sync sticky clip shell — avoids waiting for React commit on resize. */
export function writeWaveformStickyShellWidth(
  stickyEl: HTMLElement,
  viewportWidthPx: number,
): void {
  if (viewportWidthPx <= 0) return;
  stickyEl.style.width = `${viewportWidthPx}px`;
}

/** Imperatively sync timeline / stage shell width before React commits px/s. */
export function writeWaveformTimelineShellWidth(
  shellEl: HTMLElement,
  timelineWidthPx: number,
): void {
  if (timelineWidthPx <= 0) return;
  shellEl.style.width = `${timelineWidthPx}px`;
}

export function writeWaveformPeaksStageShellWidth(
  shellEl: HTMLElement,
  stageWidthPx: number,
): void {
  if (stageWidthPx <= 0) return;
  shellEl.style.width = `${stageWidthPx}px`;
}

/** Temporarily scale existing canvas to new viewport width (Peaks.js-style resize hold). */
export function applyWaveformViewportStretch(stretchEl: HTMLElement, ratio: number): void {
  if (!Number.isFinite(ratio) || Math.abs(ratio - 1) <= STRETCH_EPSILON) {
    clearWaveformViewportStretch(stretchEl);
    return;
  }
  stretchEl.style.transformOrigin = "left top";
  stretchEl.style.transform = `scaleX(${ratio})`;
}

export function clearWaveformViewportStretch(stretchEl: HTMLElement | null | undefined): void {
  if (!stretchEl) return;
  stretchEl.style.removeProperty("transform");
  stretchEl.style.removeProperty("transform-origin");
}

export function computeViewportStretchRatio(
  previousWidthPx: number,
  nextWidthPx: number,
): number | null {
  if (previousWidthPx <= 0 || nextWidthPx <= 0) return null;
  if (Math.abs(previousWidthPx - nextWidthPx) <= 1) return null;
  return nextWidthPx / previousWidthPx;
}
