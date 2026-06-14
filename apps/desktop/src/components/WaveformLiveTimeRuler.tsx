import { memo } from "react";
import { WaveformTimeRuler, type WaveformTimeRulerProps } from "./WaveformTimeRuler";
import { useWaveformLiveClock } from "../hooks/useWaveformLiveClock";

type WaveformLiveTimeRulerProps = Omit<WaveformTimeRulerProps, "currentTimeSec"> & {
  isPlaying: boolean;
  isReady: boolean;
  currentTimeSec: number;
  getPlayheadTime: () => number;
};

/** 播放期 rAF 节流标尺时间标签；播放头由 {@link WaveformViewportPlayhead} 承担。 */
export const WaveformLiveTimeRuler = memo(function WaveformLiveTimeRuler({
  isPlaying,
  isReady,
  currentTimeSec,
  getPlayheadTime,
  ...rulerProps
}: WaveformLiveTimeRulerProps) {
  const { displayTimeSec } = useWaveformLiveClock({
    isPlaying,
    isReady,
    currentTimeSec,
    getPlayheadTime,
    formatMediaTime: rulerProps.formatMediaTime,
    durationSec: rulerProps.durationSec,
    timelineWidthPx: rulerProps.timelineWidthPx,
  });

  return (
    <WaveformTimeRuler
      {...rulerProps}
      currentTimeSec={displayTimeSec}
    />
  );
});
