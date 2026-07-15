import {
  resolvePlaybackScrollFollowTargetPx,
  resolveEdgeSeekAnchorScrollPx,
  WAVEFORM_EDGE_FOLLOW,
  type WaveformPlaybackScrollFollowMode,
} from "./waveformPlaybackScrollFollow";
import {
  setPlaybackFractionalPx,
  schedulePlaybackViewportFrame,
  flushTierScrollFrame,
  writePlaybackRenderSnapshot,
} from "./tierScrollFrameCoordinator";
import {
  clearPlaybackFollowDriving,
  setCenterFollowDriving,
  setEdgeFollowDriving,
} from "./waveformPlaybackSubpixel";

/**
 * After an imperative seek, atomically land scroll on the follow target.
 *
 * Center: re-arm hard-pin; keep tiny subpixel residual for continuous follow.
 * Edge (Audacity-style seek land): **force left-anchor scroll**, hard-clear
 * `playbackFractionalPx`, rest with `edgeDriving=false`. Continuous mid-band
 * hysteresis must not run on seek — that left dirty frac / pageDrive ping-pong
 * at high zoom.
 */
export function snapPlaybackViewportAfterSeek(input: {
  timeSec: number;
  followMode: WaveformPlaybackScrollFollowMode;
  timelineWidthPx: number;
  durationSec: number;
  tierScrollEl: HTMLElement | null;
  playbackFollowScroll: (
    scrollLeftPx: number,
    options?: { deferLayoutCommit?: boolean },
  ) => void;
  /**
   * Optional: extend follow suppress (never clear — beginVisualSeek owns ∞ window).
   * Callers must not pass suppressMs: 0; that would reopen follow during setTime.
   */
  suppressUntilRef?: { current: number };
  suppressMs?: number;
}): void {
  const tier = input.tierScrollEl;
  const dur = input.durationSec;
  const tw = input.timelineWidthPx;
  if (!tier || dur < 0.5 || tw <= 0) {
    clearPlaybackFollowDriving();
    setPlaybackFractionalPx(0);
    flushTierScrollFrame({ force: true });
    return;
  }
  const vw = tier.clientWidth;
  if (vw <= 0) return;

  if (input.followMode === "center") {
    const target = resolvePlaybackScrollFollowTargetPx({
      mode: "center",
      timeSec: input.timeSec,
      timelineWidthPx: tw,
      durationSec: dur,
      viewportWidthPx: vw,
      currentScrollLeftPx: tier.scrollLeft,
    });
    const rounded = Math.round(target);
    const fractionalPx = target - rounded;
    input.playbackFollowScroll(rounded, { deferLayoutCommit: false });
    setPlaybackFractionalPx(fractionalPx);
    setCenterFollowDriving(true);
    setEdgeFollowDriving(false);
    writePlaybackRenderSnapshot({
      timeSec: input.timeSec,
      scrollLeftPx: rounded,
      fractionalPx,
      centerFollowDriving: true,
      edgeFollowDriving: false,
      playheadViewportLeftPx: vw / 2,
    });
  } else {
    // Force-anchor land: destroy float continuity (no mid-band keep / no dirty frac).
    const target = resolveEdgeSeekAnchorScrollPx({
      timeSec: input.timeSec,
      timelineWidthPx: tw,
      durationSec: dur,
      viewportWidthPx: vw,
    });
    const rounded = Math.round(target);
    input.playbackFollowScroll(rounded, { deferLayoutCommit: false });
    setPlaybackFractionalPx(0);
    setCenterFollowDriving(false);
    setEdgeFollowDriving(false);
    writePlaybackRenderSnapshot({
      timeSec: input.timeSec,
      scrollLeftPx: rounded,
      fractionalPx: 0,
      centerFollowDriving: false,
      edgeFollowDriving: false,
      playheadViewportLeftPx: vw * WAVEFORM_EDGE_FOLLOW.anchorFrac,
    });
  }

  if (input.suppressUntilRef && (input.suppressMs ?? 0) > 0) {
    const next = performance.now() + input.suppressMs!;
    input.suppressUntilRef.current = Math.max(input.suppressUntilRef.current, next);
  }
  schedulePlaybackViewportFrame(input.timeSec);
  flushTierScrollFrame({ force: true });
}
