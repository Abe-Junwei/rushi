import { memo, useCallback, useEffect, useRef } from "react";
import type { WaveformPlaybackScrollFollowMode } from "../utils/waveformPlaybackScrollFollow";
import { playheadViewportLeftPx } from "../utils/waveformProjection";
import { setCspLayoutRules } from "../utils/cspElementLayout";
import { subscribeTierScrollFrame } from "../utils/tierScrollFrameCoordinator";
import {
  resolveTierViewportMetricsDuringScrollFrame,
  type TierScrollLayoutMetrics,
  type TierScrollLiveRefs,
} from "../utils/waveformViewport";

type WaveformViewportPlayheadProps = {
  durationSec: number;
  timelineWidthPx: number;
  tierScrollLayout: TierScrollLayoutMetrics;
  tierScrollLive?: TierScrollLiveRefs;
  tierScrollRef?: React.RefObject<HTMLElement | null>;
  isPlaying: boolean;
  isReady: boolean;
  currentTimeSec: number;
  getVisualPlayheadTimeSec: () => number;
  /** Single playback tick bus; playhead transform runs here instead of its own rAF. */
  subscribePlayheadFrame: (cb: (timeSec: number) => void, priority?: number) => () => void;
  playbackFollowMode: WaveformPlaybackScrollFollowMode;
};

/**
 * Full-height playhead in sticky viewport coordinates (same path dev + release).
 * Center follow (Audacity pinned / Logic scroll-in-play): playhead stays fixed at
 * viewport center while tier scroll moves the timeline underneath.
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
  getVisualPlayheadTimeSec,
  subscribePlayheadFrame,
  playbackFollowMode,
}: WaveformViewportPlayheadProps) {
  const playheadRef = useRef<HTMLDivElement | null>(null);
  const lastTransformRef = useRef("");
  const argsRef = useRef({
    durationSec,
    timelineWidthPx,
    tierScrollLayout,
    tierScrollLive,
    tierScrollRef,
    isPlaying,
    currentTimeSec,
    getVisualPlayheadTimeSec,
    playbackFollowMode,
  });
  argsRef.current = {
    durationSec,
    timelineWidthPx,
    tierScrollLayout,
    tierScrollLive,
    tierScrollRef,
    isPlaying,
    currentTimeSec,
    getVisualPlayheadTimeSec,
    playbackFollowMode,
  };

  const writePosition = useCallback((timeSec: number) => {
    const el = playheadRef.current;
    const args = argsRef.current;
    if (!el || args.durationSec <= 0 || args.timelineWidthPx <= 0) return;
    const metrics = resolveTierViewportMetricsDuringScrollFrame({
      tierScrollEl: args.tierScrollRef?.current ?? null,
      tierScrollLive: args.tierScrollLive,
      tierScrollLayout: args.tierScrollLayout,
    });
    const leftPx =
      args.isPlaying && args.playbackFollowMode === "center"
        ? metrics.viewportWidthPx / 2
        : playheadViewportLeftPx(
            timeSec,
            metrics.scrollLeftPx,
            args.timelineWidthPx,
            args.durationSec,
          );
    const transform = `translate3d(${leftPx.toFixed(3)}px, 0, 0)`;
    if (lastTransformRef.current === transform) return;
    lastTransformRef.current = transform;
    setCspLayoutRules(el, { transform });
  }, []);

  useEffect(() => {
    if (!isReady || !isPlaying) return;
    writePosition(getVisualPlayheadTimeSec());
    return subscribePlayheadFrame((timeSec) => writePosition(timeSec));
  }, [getVisualPlayheadTimeSec, isPlaying, isReady, subscribePlayheadFrame, writePosition]);

  useEffect(() => {
    if (isPlaying || !isReady) return;
    writePosition(currentTimeSec);
  }, [currentTimeSec, isPlaying, isReady, writePosition]);

  useEffect(() => {
    if (!isReady) return;
    const onScrollFrame = () => {
      const args = argsRef.current;
      const timeSec = args.isPlaying ? args.getVisualPlayheadTimeSec() : args.currentTimeSec;
      writePosition(timeSec);
    };
    return subscribeTierScrollFrame(onScrollFrame);
  }, [isReady, writePosition]);

  if (!isReady || durationSec <= 0 || timelineWidthPx <= 0) {
    return null;
  }

  return <div ref={playheadRef} className="waveform-viewport-playhead" aria-hidden />;
});
