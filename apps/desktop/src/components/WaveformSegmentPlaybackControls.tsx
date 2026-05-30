import { memo, type RefObject } from "react";
import { Play, Repeat, Square } from "lucide-react";
import type { SegmentDto } from "../tauri/projectApi";
import { computeRegionActionOverlayLeftPx } from "../utils/waveformRegionActionOverlay";
import { timeToTimelinePx } from "../utils/waveformProjection";
import {
  resolveTierViewportMetrics,
  type TierScrollLayoutMetrics,
  type TierScrollLiveRefs,
} from "../utils/waveformViewport";
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";
import { WaveformPlaybackRateMenu } from "./WaveformPlaybackRateMenu";

type WaveformSegmentPlaybackControlsProps = {
  disabled: boolean;
  isPlaying: boolean;
  timelineWidthPx: number;
  durationSec: number;
  tierScrollRef: RefObject<HTMLElement | null>;
  tierScrollLive: TierScrollLiveRefs;
  tierScrollLayout: TierScrollLayoutMetrics;
  selectedSegment: SegmentDto | null;
  segmentPlaybackRate: number;
  segmentLoopPlayback: boolean;
  onPlaybackRateChange: (rate: number) => void;
  onToggleLoop: () => void;
  onTogglePlay: () => void;
};

export const WaveformSegmentPlaybackControls = memo(function WaveformSegmentPlaybackControls({
  disabled,
  isPlaying,
  timelineWidthPx,
  durationSec,
  tierScrollRef,
  tierScrollLive,
  tierScrollLayout,
  selectedSegment,
  segmentPlaybackRate,
  segmentLoopPlayback,
  onPlaybackRateChange,
  onToggleLoop,
  onTogglePlay,
}: WaveformSegmentPlaybackControlsProps) {
  if (!selectedSegment) return null;
  const { scrollLeftPx, viewportWidthPx } = resolveTierViewportMetrics({
    tierScrollEl: tierScrollRef.current,
    tierScrollLive,
    tierScrollLayout,
  });
  const lo = Math.min(selectedSegment.start_sec, selectedSegment.end_sec);
  const hi = Math.max(selectedSegment.start_sec, selectedSegment.end_sec);
  const leftPx = timeToTimelinePx(lo, timelineWidthPx, durationSec);
  const rightPx = timeToTimelinePx(hi, timelineWidthPx, durationSec);
  const widthPx = Math.max(2, rightPx - leftPx);
  if (leftPx + widthPx < scrollLeftPx || leftPx > scrollLeftPx + viewportWidthPx) return null;

  const showSpeedMenu = widthPx >= 88;
  const showLoopBtn = widthPx >= 72;
  const overlayLeftPx = computeRegionActionOverlayLeftPx({
    segmentStartPx: leftPx,
    segmentWidthPx: widthPx,
    scrollLeftPx,
    viewportWidthPx,
  });
  return (
    <div className="region-action-overlay" style={{ left: overlayLeftPx }}>
      {showSpeedMenu ? (
        <WaveformPlaybackRateMenu
          variant="segment"
          tierScrollRef={tierScrollRef}
          disabled={disabled}
          playbackRate={segmentPlaybackRate}
          onPlaybackRateChange={onPlaybackRateChange}
        />
      ) : null}
      {showLoopBtn ? (
        <button
          type="button"
          className={`region-action-btn${segmentLoopPlayback ? " region-action-btn-active" : ""}`}
          disabled={disabled}
          aria-pressed={segmentLoopPlayback}
          aria-label={segmentLoopPlayback ? "关闭语段循环播放" : "开启语段循环播放"}
          title={segmentLoopPlayback ? "关闭语段循环播放" : "开启语段循环播放"}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onToggleLoop();
          }}
        >
          <Repeat className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
        </button>
      ) : null}
      <button
        type="button"
        className="region-action-btn"
        disabled={disabled}
        aria-label={isPlaying ? "停止语段播放" : "播放选中语段"}
        title={isPlaying ? "停止语段播放" : "播放选中语段"}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onTogglePlay();
        }}
      >
        {isPlaying ? (
          <Square className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
        ) : (
          <Play className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
        )}
      </button>
    </div>
  );
});
