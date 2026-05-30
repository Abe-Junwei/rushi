import { computeTimelineWidthPx } from "./segmentLayout";
import { clampTimelineScrollLeftPx } from "./waveformScrollSync";
import { scrollPxPreservingViewportCenterTime } from "./waveformProjection";

/** Remap tier scroll when px/s changes so the viewport center time stays fixed. */
export function remapWaveformScrollLeftPx(input: {
  scrollLeftPx: number;
  oldPxPerSec: number;
  newPxPerSec: number;
  durationSec: number;
  viewportWidthPx: number;
}): number {
  const oldTw = computeTimelineWidthPx(input.durationSec, input.oldPxPerSec);
  const newTw = computeTimelineWidthPx(input.durationSec, input.newPxPerSec);
  return scrollPxPreservingViewportCenterTime({
    scrollLeftPx: input.scrollLeftPx,
    oldTimelineWidthPx: oldTw,
    newTimelineWidthPx: newTw,
    durationSec: input.durationSec,
    viewportWidthPx: input.viewportWidthPx,
  });
}

/** Clamp scroll to the current timeline width. */
export function clampWaveformScrollLeftPx(input: {
  scrollLeftPx: number;
  pxPerSec: number;
  durationSec: number;
  viewportWidthPx: number;
}): number {
  const tw = computeTimelineWidthPx(input.durationSec, input.pxPerSec);
  return clampTimelineScrollLeftPx({
    scrollLeftPx: input.scrollLeftPx,
    timelineWidthPx: tw,
    viewportWidthPx: input.viewportWidthPx,
  });
}
