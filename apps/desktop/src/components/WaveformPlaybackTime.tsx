import { memo } from "react";
import { useWaveformLiveClock } from "../hooks/useWaveformLiveClock";

type WaveformPlaybackTimeProps = {
  className?: string;
  isPlaying: boolean;
  isReady: boolean;
  durationSec: number;
  currentTimeSec: number;
  getDisplayPlayheadTimeSec: () => number;
  formatMediaTime: (sec: number) => string;
  subscribePlayheadFrame?: (cb: (timeSec: number) => void) => () => void;
};

export const WaveformPlaybackTime = memo(function WaveformPlaybackTime({
  className,
  isPlaying,
  isReady,
  durationSec,
  currentTimeSec,
  getDisplayPlayheadTimeSec,
  formatMediaTime,
  subscribePlayheadFrame,
}: WaveformPlaybackTimeProps) {
  const { displayTimeLabel, durationLabel } = useWaveformLiveClock({
    isPlaying,
    isReady,
    currentTimeSec,
    getDisplayPlayheadTimeSec,
    formatMediaTime,
    durationSec,
    subscribePlayheadFrame,
  });

  return (
    <span className={className ? `${className} waveform-playback-time` : "waveform-playback-time"} aria-live="polite">
      {displayTimeLabel} / {durationLabel}
    </span>
  );
});
