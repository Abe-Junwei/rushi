/** Scroll-window math for timeline-native segment band canvas (virtual window). */

export const SEGMENT_BAND_CANVAS_BUFFER_VIEWPORTS = 1.5;

export type SegmentBandCanvasWindow = {
  leftPx: number;
  widthPx: number;
  bufferPx: number;
};

export function computeSegmentBandCanvasWindow(input: {
  scrollLeftPx: number;
  viewportWidthPx: number;
  timelineWidthPx: number;
}): SegmentBandCanvasWindow {
  const timelineWidth = Math.max(1, input.timelineWidthPx);
  const viewportWidth = Math.max(1, input.viewportWidthPx);
  const bufferPx = viewportWidth * SEGMENT_BAND_CANVAS_BUFFER_VIEWPORTS;
  const widthPx = Math.max(1, Math.floor(Math.min(timelineWidth, viewportWidth + bufferPx * 2)));
  const leftPx = Math.max(
    0,
    Math.min(Math.max(0, timelineWidth - widthPx), input.scrollLeftPx - bufferPx),
  );
  return { leftPx, widthPx, bufferPx };
}

/**
 * True when the visible viewport (+ inner margin) has scrolled outside the last
 * painted canvas window — caller should reposition and redraw.
 *
 * When false, native tier scroll already moves the canvas; skip left writes and
 * canvas redraw for this scroll frame.
 */
export function segmentBandCanvasNeedsRepaint(input: {
  scrollLeftPx: number;
  viewportWidthPx: number;
  paintedLeftPx: number;
  paintedWidthPx: number;
  paintedHeightPx: number;
  layoutHeightPx: number;
  bufferPx: number;
}): boolean {
  if (input.paintedLeftPx < 0 || input.paintedWidthPx <= 0) return true;
  if (input.layoutHeightPx !== input.paintedHeightPx) return true;

  const viewportWidth = Math.max(1, input.viewportWidthPx);
  const visibleStart = input.scrollLeftPx;
  const visibleEnd = input.scrollLeftPx + viewportWidth;
  const innerMargin = Math.max(8, input.bufferPx * 0.35);
  const safeStart = input.paintedLeftPx + innerMargin;
  const safeEnd = input.paintedLeftPx + input.paintedWidthPx - innerMargin;

  if (safeEnd <= safeStart) return true;
  return visibleStart < safeStart || visibleEnd > safeEnd;
}

/** Dedupe imperative CSP left updates during scroll bursts. */
export function cspLayoutLeftPxIfChanged(
  element: HTMLElement,
  leftPx: number,
  lastLeftPxRef: { current: number | null },
  setRules: (
    el: HTMLElement,
    rules: Record<string, string | number | null | undefined>,
  ) => void,
): void {
  const rounded = Math.round(leftPx * 1000) / 1000;
  if (lastLeftPxRef.current === rounded) return;
  lastLeftPxRef.current = rounded;
  setRules(element, { left: leftPx });
}
