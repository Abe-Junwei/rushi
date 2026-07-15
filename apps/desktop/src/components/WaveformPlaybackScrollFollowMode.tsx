import { memo } from "react";
import type { WaveformPlaybackScrollFollowMode } from "../utils/waveformPlaybackScrollFollow";
import {
  WAVEFORM_PLAYBACK_SCROLL_FOLLOW_GROUP_LABEL,
  WAVEFORM_PLAYBACK_SCROLL_FOLLOW_UI_MODES,
} from "../utils/waveformPlaybackScrollFollowUi";
import { LUCIDE_ICON_SIZE_MD, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";

export type WaveformPlaybackScrollFollowModeProps = {
  disabled: boolean;
  mode: WaveformPlaybackScrollFollowMode;
  onModeChange: (mode: WaveformPlaybackScrollFollowMode) => void;
};

/** 播放头滚屏：翻页（近边才滚） / 居中（锁中线、波形平移）。 */
export const WaveformPlaybackScrollFollowModeControl = memo(function WaveformPlaybackScrollFollowModeControl({
  disabled,
  mode,
  onModeChange,
}: WaveformPlaybackScrollFollowModeProps) {
  return (
    <div
      className="waveform-scroll-follow-segment"
      role="group"
      aria-label={WAVEFORM_PLAYBACK_SCROLL_FOLLOW_GROUP_LABEL}
    >
      {WAVEFORM_PLAYBACK_SCROLL_FOLLOW_UI_MODES.map(({ id, ariaLabel, title, Icon }) => {
        const active = mode === id;
        return (
          <button
            key={id}
            type="button"
            className={`waveform-scroll-follow-segment-btn${active ? " waveform-scroll-follow-segment-btn-active workbench-state-btn-active" : ""}`}
            disabled={disabled}
            title={title}
            aria-label={ariaLabel}
            aria-pressed={active}
            onClick={() => onModeChange(id)}
          >
            <Icon className={LUCIDE_ICON_SIZE_MD} stroke={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
          </button>
        );
      })}
    </div>
  );
});
