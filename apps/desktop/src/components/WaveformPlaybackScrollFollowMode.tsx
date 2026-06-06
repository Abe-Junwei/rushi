import { memo } from "react";
import { ChevronsLeftRight, Crosshair, type LucideIcon } from "lucide-react";
import type { WaveformPlaybackScrollFollowMode } from "../utils/waveformPlaybackScrollFollow";
import { LUCIDE_ICON_SIZE_MD, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";

export type WaveformPlaybackScrollFollowModeProps = {
  disabled: boolean;
  mode: WaveformPlaybackScrollFollowMode;
  onModeChange: (mode: WaveformPlaybackScrollFollowMode) => void;
};

const MODES: Array<{
  id: WaveformPlaybackScrollFollowMode;
  label: string;
  ariaLabel: string;
  title: string;
  Icon: LucideIcon;
}> = [
  {
    id: "edge",
    label: "跟随",
    ariaLabel: "跟随播放：近边缘时滚屏",
    title: "跟随播放：播放头在视口内移动，接近左右边缘时自动滚屏",
    Icon: ChevronsLeftRight,
  },
  {
    id: "center",
    label: "居中",
    ariaLabel: "居中锁定：播放头固定中央",
    title: "居中锁定：播放头固定在视口中央，波形随播放平移",
    Icon: Crosshair,
  },
];

/** 播放滚屏：跟随（近边滚） / 居中（定头平移）。 */
export const WaveformPlaybackScrollFollowModeControl = memo(function WaveformPlaybackScrollFollowModeControl({
  disabled,
  mode,
  onModeChange,
}: WaveformPlaybackScrollFollowModeProps) {
  return (
    <div
      className="waveform-scroll-follow-segment"
      role="group"
      aria-label="播放滚屏方式"
    >
      {MODES.map(({ id, label, ariaLabel, title, Icon }) => {
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
            <Icon className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
            <span className="waveform-scroll-follow-segment-label">{label}</span>
          </button>
        );
      })}
    </div>
  );
});
