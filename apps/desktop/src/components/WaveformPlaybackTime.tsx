import { memo } from "react";
import { useWaveformLiveClock } from "../hooks/useWaveformLiveClock";

type WaveformPlaybackTimeProps = {
  className?: string;
  isPlaying: boolean;
  isReady: boolean;
  durationSec: number;
  getPlayheadTime: () => number;
  formatMediaTime: (sec: number) => string;
};

export const WaveformPlaybackTime = memo(function WaveformPlaybackTime({
  className,
  isPlaying,
  isReady,
  durationSec,
  getPlayheadTime,
  formatMediaTime,
}: WaveformPlaybackTimeProps) {
  const { displayTimeLabel, durationLabel } = useWaveformLiveClock({
    isPlaying,
    isReady,
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
