import { scrollPxCenterTimeInViewport, timeToTimelinePx } from "./waveformProjection";

/** Stationary playhead (Logic scroll-in-play / Audition Centered). */
export type WaveformPlaybackScrollFollowMode = "center" | "edge";

/**
 * Edge follow (Audacity / Pro Tools Follow Playhead): playhead moves freely in the
 * middle band; scroll only when it nears the viewport edges, anchoring with hysteresis.
 */
export const WAVEFORM_EDGE_FOLLOW = {
  triggerHighFrac: 0.88,
  triggerLowFrac: 0.12,
  anchorFrac: 0.15,
} as const;

export function resolvePlaybackScrollFollowTargetPx(input: {
  mode: WaveformPlaybackScrollFollowMode;
  timeSec: number;
  timelineWidthPx: number;
  durationSec: number;
  viewportWidthPx: number;
  currentScrollLeftPx: number;
}): number {
  const vw = Math.max(1, input.viewportWidthPx);
  const tw = Math.max(input.timelineWidthPx, 0);
  const maxSl = Math.max(0, tw - vw);

  if (input.mode === "center") {
    return scrollPxCenterTimeInViewport({
      timeSec: input.timeSec,
      timelineWidthPx: tw,
      durationSec: input.durationSec,
      viewportWidthPx: vw,
    });
  }

  const playheadPx = timeToTimelinePx(input.timeSec, tw, input.durationSec);
  const playheadVpX = playheadPx - input.currentScrollLeftPx;
  const triggerHigh = vw * WAVEFORM_EDGE_FOLLOW.triggerHighFrac;
  const triggerLow = vw * WAVEFORM_EDGE_FOLLOW.triggerLowFrac;
  const anchor = vw * WAVEFORM_EDGE_FOLLOW.anchorFrac;

  if (playheadVpX > triggerHigh || playheadVpX < triggerLow) {
    return Math.max(0, Math.min(maxSl, playheadPx - anchor));
  }

  return Math.max(0, Math.min(maxSl, input.currentScrollLeftPx));
}

/**
 * Edge seek land: always put playhead at {@link WAVEFORM_EDGE_FOLLOW.anchorFrac}.
 * Continuous mid-band hysteresis must not apply to interactive seek (Audacity-style).
 */
export function resolveEdgeSeekAnchorScrollPx(input: {
  timeSec: number;
  timelineWidthPx: number;
  durationSec: number;
  viewportWidthPx: number;
}): number {
  const vw = Math.max(1, input.viewportWidthPx);
  const tw = Math.max(input.timelineWidthPx, 0);
  const maxSl = Math.max(0, tw - vw);
  const playheadPx = timeToTimelinePx(input.timeSec, tw, input.durationSec);
  const anchor = vw * WAVEFORM_EDGE_FOLLOW.anchorFrac;
  return Math.max(0, Math.min(maxSl, playheadPx - anchor));
}
