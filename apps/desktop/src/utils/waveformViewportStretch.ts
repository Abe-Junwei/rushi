import { setCspLayoutRules, clearCspLayoutRules } from "./cspElementLayout";

const STRETCH_EPSILON = 0.001;

export type WriteWaveformShellLayoutInput = {
  timelineShell?: HTMLElement | null;
  peaksStageShell?: HTMLElement | null;
  stickyShell?: HTMLElement | null;
  timelineWidthPx: number;
  viewportWidthPx: number;
};

/** Imperatively sync timeline / stage / sticky shells (layout truth for resize + zoom). */
export function writeWaveformShellLayout(input: WriteWaveformShellLayoutInput): void {
  const {
    timelineShell,
    peaksStageShell,
    stickyShell,
    timelineWidthPx,
    viewportWidthPx,
  } = input;
  if (timelineWidthPx <= 0 || viewportWidthPx <= 0) return;
  const stageWidthPx = Math.max(timelineWidthPx, viewportWidthPx);
  if (timelineShell) writeWaveformTimelineShellWidth(timelineShell, timelineWidthPx);
  if (peaksStageShell) writeWaveformPeaksStageShellWidth(peaksStageShell, stageWidthPx);
  if (stickyShell) writeWaveformStickyShellWidth(stickyShell, viewportWidthPx);
}

export function writeWaveformStickyShellWidth(
  stickyEl: HTMLElement,
  viewportWidthPx: number,
): void {
  if (viewportWidthPx <= 0) return;
  setCspLayoutRules(stickyEl, { width: viewportWidthPx });
}

export function writeWaveformTimelineShellWidth(
  shellEl: HTMLElement,
  timelineWidthPx: number,
): void {
  if (timelineWidthPx <= 0) return;
  setCspLayoutRules(shellEl, { width: timelineWidthPx });
}

export function writeWaveformPeaksStageShellWidth(
  shellEl: HTMLElement,
  stageWidthPx: number,
): void {
  if (stageWidthPx <= 0) return;
  setCspLayoutRules(shellEl, { width: stageWidthPx });
}

export function applyWaveformViewportStretch(stretchEl: HTMLElement, ratio: number): void {
  if (!Number.isFinite(ratio) || Math.abs(ratio - 1) <= STRETCH_EPSILON) {
    clearWaveformViewportStretch(stretchEl);
    return;
  }
  setCspLayoutRules(stretchEl, {
    transformOrigin: "left top",
    transform: `scaleX(${ratio})`,
  });
}

export function clearWaveformViewportStretch(stretchEl: HTMLElement | null | undefined): void {
  if (!stretchEl) return;
  clearCspLayoutRules(stretchEl);
}

export function computeViewportStretchRatio(
  previousWidthPx: number,
  nextWidthPx: number,
): number | null {
  if (previousWidthPx <= 0 || nextWidthPx <= 0) return null;
  if (Math.abs(previousWidthPx - nextWidthPx) <= 1) return null;
  return nextWidthPx / previousWidthPx;
}
