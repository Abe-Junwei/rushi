import { memo } from "react";
import { Play, Repeat, Square } from "lucide-react";
import type { SegmentDto } from "../tauri/projectApi";
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";

type WaveformSegmentPlaybackControlsProps = {
  disabled: boolean;
  isPlaying: boolean;
  pxPerSec: number;
  scrollLeftPx: number;
  viewportWidthPx: number;
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
  pxPerSec,
  scrollLeftPx,
  viewportWidthPx,
  selectedSegment,
  segmentPlaybackRate,
  segmentLoopPlayback,
  onPlaybackRateChange,
  onToggleLoop,
  onTogglePlay,
}: WaveformSegmentPlaybackControlsProps) {
  if (!selectedSegment) return null;
  const leftPx = Math.min(selectedSegment.start_sec, selectedSegment.end_sec) * pxPerSec;
  const widthPx = Math.abs(selectedSegment.end_sec - selectedSegment.start_sec) * pxPerSec;
  if (leftPx + widthPx < scrollLeftPx || leftPx > scrollLeftPx + viewportWidthPx) return null;

  const showSpeedSlider = widthPx >= 160;
  const showLoopBtn = widthPx >= 72;
  const speedLabel =
    segmentPlaybackRate === 1
      ? "1x"
      : `${segmentPlaybackRate.toFixed(segmentPlaybackRate % 0.25 === 0 ? 1 : 2)}x`;

  return (
    <div className="region-action-overlay" style={{ left: Math.max(0, leftPx) }}>
      {showSpeedSlider ? (
        <div className="segment-speed-control" onPointerDown={(e) => e.stopPropagation()}>
          <input
            type="range"
            className="segment-speed-slider"
            min={0.25}
            max={2}
            step={0.05}
            disabled={disabled}
            value={segmentPlaybackRate}
            onChange={(e) => onPlaybackRateChange(Number(e.target.value))}
            aria-label={`语段播放速度，当前 ${speedLabel}`}
            title={`语段播放速度 ${speedLabel}`}
          />
          <span
            className={`segment-speed-label${segmentPlaybackRate !== 1 ? " segment-speed-label-reset" : ""}`}
            role={segmentPlaybackRate !== 1 ? "button" : undefined}
            tabIndex={segmentPlaybackRate !== 1 && !disabled ? 0 : -1}
            title={segmentPlaybackRate !== 1 ? "恢复正常速度" : "正常速度"}
            onClick={() => {
              if (disabled) return;
              onPlaybackRateChange(1);
            }}
            onKeyDown={(e) => {
              if (disabled || segmentPlaybackRate === 1) return;
              if (e.key !== "Enter" && e.key !== " ") return;
              e.preventDefault();
              onPlaybackRateChange(1);
            }}
          >
            {speedLabel}
          </span>
        </div>
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
