import { memo } from "react";
import { useWaveformLiveClock } from "../hooks/useWaveformLiveClock";

type WaveformPlaybackTimeProps = {
  isPlaying: boolean;
  isReady: boolean;
  durationSec: number;
  getPlayheadTime: () => number;
  formatMediaTime: (sec: number) => string;
};

export const WaveformPlaybackTime = memo(function WaveformPlaybackTime({
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
    <span className="waveform-playback-time" aria-live="polite">
      {displayTimeLabel} / {durationLabel}
    </span>
  );
});
