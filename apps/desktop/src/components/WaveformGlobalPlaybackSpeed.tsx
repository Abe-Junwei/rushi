import { memo } from "react";
import { WaveformPlaybackRateMenu } from "./WaveformPlaybackRateMenu";

export type WaveformGlobalPlaybackSpeedProps = {
  disabled: boolean;
  playbackRate: number;
  onPlaybackRateChange: (rate: number) => void;
};

/** 全局播放变速（主 transport 播放按钮右侧）。 */
export const WaveformGlobalPlaybackSpeed = memo(function WaveformGlobalPlaybackSpeed(props: WaveformGlobalPlaybackSpeedProps) {
  return <WaveformPlaybackRateMenu {...props} variant="global" />;
});
