import { memo } from "react";
import { useWaveformLiveClock } from "../hooks/useWaveformLiveClock";

type WaveformPlaybackTimeProps = {
  className?: string;
  isPlaying: boolean;
  isReady: boolean;
  durationSec: number;
  currentTimeSec: number;
  getPlayheadTime: () => number;
  formatMediaTime: (sec: number) => string;
};

export const WaveformPlaybackTime = memo(function WaveformPlaybackTime({
  className,
  isPlaying,
  isReady,
  durationSec,
  currentTimeSec,
  getPlayheadTime,
  formatMediaTime,
}: WaveformPlaybackTimeProps) {
  const { displayTimeLabel, durationLabel } = useWaveformLiveClock({
    isPlaying,
    isReady,
    currentTimeSec,
    getPlayheadTime,
    formatMediaTime,
    durationSec,
  });

  return (
    <span className={className ? `${className} waveform-playback-time` : "waveform-playback-time"} aria-live="polite">
      {displayTimeLabel} / {durationLabel}
    </span>
  );
});
