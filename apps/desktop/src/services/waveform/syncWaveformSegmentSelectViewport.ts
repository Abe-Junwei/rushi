import { segmentStartSec } from "../../utils/formatMediaTime";
import {
  requestWaveformSegmentBandPaint,
  scheduleTierScrollFrame,
} from "../../utils/tierScrollFrameCoordinator";
import { resolveSelectSegmentViewportPlan, type SegmentTimeRange } from "./selectSegmentViewportPlan";
import { waveformAtomicSeek } from "./waveformAtomicSeek";

export type WaveformSegmentSelectViewportTimeline = {
  suppressPlaybackFollowForSelectionSeek: () => void;
  wfApiRef: { current: { seek: (timeSec: number) => void } };
  viewportFit: { revealSegmentInViewport: (seg: SegmentTimeRange) => void };
};

/** Imperative seek + center for waveform segment select — no React commit. */
export function syncWaveformSegmentSelectSeek(
  timeline: WaveformSegmentSelectViewportTimeline,
  segment: SegmentTimeRange,
): void {
  const startSec = segmentStartSec(segment);
  timeline.suppressPlaybackFollowForSelectionSeek();
  waveformAtomicSeek(timeline, startSec);
}

/**
 * Pointerdown preview: seek and reveal in one sync block, then publish playhead
 * after tier scroll has moved so viewport-coordinate playhead does not jump.
 */
export function syncWaveformSegmentSelectPreviewViewport(
  timeline: WaveformSegmentSelectViewportTimeline,
  segment: SegmentTimeRange,
): void {
  const startSec = segmentStartSec(segment);
  timeline.suppressPlaybackFollowForSelectionSeek();
  waveformAtomicSeek(timeline, startSec);
  syncWaveformSegmentSelectReveal(timeline, segment, { forceBandPaint: false });
}

/** Imperative tier scroll to fit segment — defer band paint when called from preview rAF. */
export function syncWaveformSegmentSelectReveal(
  timeline: WaveformSegmentSelectViewportTimeline,
  segment: SegmentTimeRange,
  opts?: { forceBandPaint?: boolean },
): void {
  const plan = resolveSelectSegmentViewportPlan(segment);
  timeline.viewportFit.revealSegmentInViewport(plan.segment);
  if (opts?.forceBandPaint === false) {
    scheduleTierScrollFrame();
  } else {
    requestWaveformSegmentBandPaint({ force: true });
  }
}

/** Seek to segment start and center viewport in one suppress window. */
export function syncWaveformSegmentSelectViewport(
  timeline: WaveformSegmentSelectViewportTimeline,
  segment: SegmentTimeRange,
): void {
  syncWaveformSegmentSelectSeek(timeline, segment);
  syncWaveformSegmentSelectReveal(timeline, segment);
}
