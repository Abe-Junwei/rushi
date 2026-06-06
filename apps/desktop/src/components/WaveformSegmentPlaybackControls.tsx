import { memo, useRef, type RefObject } from "react";
import { Play, Repeat, Square } from "lucide-react";
import type { SegmentDto } from "../tauri/projectApi";
import { useTierViewportMetricsFrame } from "../hooks/useTierViewportMetricsFrame";
import { useWaveformSegmentPlaybackControlsOverlayFrame } from "../hooks/useWaveformSegmentPlaybackControlsOverlayFrame";
import { resolveSegmentPlaybackControlsOverlayLayout } from "../utils/waveformRegionActionOverlay";
import type { TierScrollLayoutMetrics, TierScrollLiveRefs } from "../utils/waveformViewport";
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";
import { WaveformPlaybackRateMenu } from "./WaveformPlaybackRateMenu";

type WaveformSegmentPlaybackControlsProps = {
  disabled: boolean;
  /** 底部嵌入时间尺占用高度，控件在其上方居中 */
  rulerBandHeightPx?: number;
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
  rulerBandHeightPx = 0,
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
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const { scrollLeftPx, viewportWidthPx } = useTierViewportMetricsFrame({
    tierScrollRef,
    tierScrollLive,
    tierScrollLayout,
    commitScrollFrame: !isPlaying,
  });

  const segmentStartSec = selectedSegment
    ? Math.min(selectedSegment.start_sec, selectedSegment.end_sec)
    : 0;
  const segmentEndSec = selectedSegment
    ? Math.max(selectedSegment.start_sec, selectedSegment.end_sec)
    : 0;

  useWaveformSegmentPlaybackControlsOverlayFrame({
    enabled: isPlaying && selectedSegment != null,
    overlayRef,
    tierScrollRef,
    tierScrollLive,
    tierScrollLayout,
    segmentStartSec,
    segmentEndSec,
    timelineWidthPx,
    durationSec,
  });

  if (!selectedSegment) return null;

  const layout = resolveSegmentPlaybackControlsOverlayLayout({
    segmentStartSec,
    segmentEndSec,
    timelineWidthPx,
    durationSec,
    scrollLeftPx,
    viewportWidthPx,
  });

  if (!isPlaying && !layout.visible) return null;

  return (
    <div
      ref={overlayRef}
      className="region-action-overlay"
      style={
        isPlaying
          ? { bottom: rulerBandHeightPx + 4 }
          : {
              left: layout.overlayLeftPx,
              width: layout.overlayWidthPx,
              bottom: rulerBandHeightPx + 4,
            }
      }
    >
      {layout.showSpeedMenu ? (
        <WaveformPlaybackRateMenu
          variant="segment"
          tierScrollRef={tierScrollRef}
          disabled={disabled}
          playbackRate={segmentPlaybackRate}
          onPlaybackRateChange={onPlaybackRateChange}
        />
      ) : null}
      {layout.showLoopBtn ? (
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
