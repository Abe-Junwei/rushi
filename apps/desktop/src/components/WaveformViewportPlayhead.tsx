import { memo, useCallback, useEffect, useRef } from "react";
import { playheadViewportLeftPx } from "../utils/waveformProjection";
import { setDirectLayoutStyle } from "../utils/cspElementLayout";
import {
  subscribeTierScrollFrame,
  readPlaybackRenderSnapshot,
  isTierScrollFrameActive,
} from "../utils/tierScrollFrameCoordinator";
import {
  resolveTierViewportMetricsDuringScrollFrame,
  type TierScrollLayoutMetrics,
  type TierScrollLiveRefs,
} from "../utils/waveformViewport";
import { PLAYBACK_SUBPIXEL_ENABLED, isCenterFollowDriving, isEdgeFollowDriving } from "../utils/waveformPlaybackSubpixel";
import {
  WAVEFORM_EDGE_FOLLOW,
  type WaveformPlaybackScrollFollowMode,
} from "../utils/waveformPlaybackScrollFollow";

type WaveformViewportPlayheadProps = {
  durationSec: number;
  timelineWidthPx: number;
  tierScrollLayout: TierScrollLayoutMetrics;
  tierScrollLive?: TierScrollLiveRefs;
  tierScrollRef?: React.RefObject<HTMLElement | null>;
  isPlaying: boolean;
  isReady: boolean;
  /** Paused seek commits — retriggers transform without playhead rAF bus. */
  currentTimeSec: number;
  getDisplayPlayheadTimeSec: () => number;
  /** Single playback tick bus; playhead transform runs here instead of its own rAF. */
  subscribePlayheadFrame: (cb: (timeSec: number) => void, priority?: number) => () => void;
  /** Segment = accent playhead; global = fixed cool slate. */
  playheadChromeMode?: "segment" | "global";
  /**
   * P0: while follow is driving, hard-pin (center → vw/2; edge page-drive →
   * anchorFrac×vw). Mid-band edge / paused keep time→viewport mapping.
   */
  playbackFollowMode?: WaveformPlaybackScrollFollowMode;
};

/**
 * Full-height playhead in viewport coordinates.
 * Driving follow: hard-pinned (center mid / edge anchor); content moves under it.
 * Otherwise: time → viewport x from effectiveScrollLeftPx (S + shared float offset).
 */
export const WaveformViewportPlayhead = memo(function WaveformViewportPlayhead({
  durationSec,
  timelineWidthPx,
  tierScrollLayout,
  tierScrollLive,
  tierScrollRef,
  isPlaying,
  isReady,
  currentTimeSec,
  getDisplayPlayheadTimeSec,
  subscribePlayheadFrame,
  playheadChromeMode = "segment",
  playbackFollowMode = "edge",
}: WaveformViewportPlayheadProps) {
  const playheadRef = useRef<HTMLDivElement | null>(null);
  const lastTransformRef = useRef("");
  const argsRef = useRef({
    durationSec,
    timelineWidthPx,
    tierScrollLayout,
    tierScrollLive,
    tierScrollRef,
    getDisplayPlayheadTimeSec,
    isPlaying,
    playbackFollowMode,
  });
  argsRef.current = {
    durationSec,
    timelineWidthPx,
    tierScrollLayout,
    tierScrollLive,
    tierScrollRef,
    getDisplayPlayheadTimeSec,
    isPlaying,
    playbackFollowMode,
  };

  const writePosition = useCallback((timeSec: number) => {
    const el = playheadRef.current;
    const args = argsRef.current;
    if (!el || args.durationSec <= 0 || args.timelineWidthPx <= 0) return;

    // Snapshot is only authoritative while a scroll frame is running (follow @Pri0
    // wrote it this frame). Outside a frame, fall back to live metrics mapping.
    const frameSnapshot = isTierScrollFrameActive() ? readPlaybackRenderSnapshot() : null;
    if (frameSnapshot) {
      const transform = `translate3d(${frameSnapshot.playheadViewportLeftPx.toFixed(3)}px, 0, 0)`;
      if (lastTransformRef.current === transform) return;
      lastTransformRef.current = transform;
      setDirectLayoutStyle(el, { transform });
      return;
    }

    const metrics = resolveTierViewportMetricsDuringScrollFrame({
      tierScrollEl: args.tierScrollRef?.current ?? null,
      tierScrollLive: args.tierScrollLive,
      tierScrollLayout: args.tierScrollLayout,
    });
    // P0: hard-pin only while follow is actively driving the float offset.
    // If user-scroll suppress freezes follow, fall back to effectiveScroll mapping
    // so the needle stays locked to the played-tint edge (same time source).
    const pinCenter =
      PLAYBACK_SUBPIXEL_ENABLED &&
      args.isPlaying &&
      args.playbackFollowMode === "center" &&
      isCenterFollowDriving() &&
      metrics.viewportWidthPx > 0;
    const pinEdge =
      PLAYBACK_SUBPIXEL_ENABLED &&
      args.isPlaying &&
      args.playbackFollowMode === "edge" &&
      isEdgeFollowDriving() &&
      metrics.viewportWidthPx > 0;
    const leftPx = pinCenter
      ? metrics.viewportWidthPx / 2
      : pinEdge
        ? metrics.viewportWidthPx * WAVEFORM_EDGE_FOLLOW.anchorFrac
        : playheadViewportLeftPx(
            timeSec,
            metrics.effectiveScrollLeftPx,
            args.timelineWidthPx,
            args.durationSec,
          );
    const transform = `translate3d(${leftPx.toFixed(3)}px, 0, 0)`;
    if (lastTransformRef.current === transform) return;
    lastTransformRef.current = transform;
    setDirectLayoutStyle(el, { transform });
  }, []);

  useEffect(() => {
    if (!isReady) return;
    writePosition(getDisplayPlayheadTimeSec());
    return subscribePlayheadFrame((timeSec) => writePosition(timeSec));
  }, [getDisplayPlayheadTimeSec, isReady, subscribePlayheadFrame, writePosition]);

  useEffect(() => {
    if (isPlaying || !isReady) return;
    writePosition(getDisplayPlayheadTimeSec());
  }, [currentTimeSec, getDisplayPlayheadTimeSec, isPlaying, isReady, writePosition]);

  useEffect(() => {
    if (!isReady) return;
    const onScrollFrame = () => {
      writePosition(argsRef.current.getDisplayPlayheadTimeSec());
    };
    return subscribeTierScrollFrame(onScrollFrame);
  }, [isReady, writePosition]);

  if (!isReady || durationSec <= 0 || timelineWidthPx <= 0) {
    return null;
  }

  return (
    <div
      ref={playheadRef}
      className={
        playheadChromeMode === "global"
          ? "waveform-viewport-playhead is-global-playhead"
          : "waveform-viewport-playhead"
      }
      aria-hidden
    />
  );
});
