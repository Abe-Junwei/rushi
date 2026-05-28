import { memo, useCallback, useEffect, useRef } from "react";
import { WaveformTimeRuler, type WaveformTimeRulerProps } from "./WaveformTimeRuler";
import { useWaveformLiveClock } from "../hooks/useWaveformLiveClock";

type WaveformLiveTimeRulerProps = Omit<WaveformTimeRulerProps, "currentTimeSec"> & {
  isPlaying: boolean;
  isReady: boolean;
  getPlayheadTime: () => number;
};

/** 播放期 rAF 驱动 playhead，减少父级 currentTime 导致的整树重绘。 */
export const WaveformLiveTimeRuler = memo(function WaveformLiveTimeRuler({
  isPlaying,
  isReady,
  getPlayheadTime,
  ...rulerProps
}: WaveformLiveTimeRulerProps) {
  const playheadLineRef = useRef<SVGLineElement | null>(null);
  const onPlayheadMove = useCallback((_t: number, leftPct: number) => {
    const line = playheadLineRef.current;
    if (!line) return;
    const pct = `${leftPct}%`;
    line.setAttribute("x1", pct);
    line.setAttribute("x2", pct);
  }, []);

  const { displayTimeSec } = useWaveformLiveClock({
    isPlaying,
    isReady,
    getPlayheadTime,
    formatMediaTime: rulerProps.formatMediaTime,
    durationSec: rulerProps.durationSec,
    onPlayheadMove: isPlaying ? onPlayheadMove : undefined,
  });

  useEffect(() => {
    if (isPlaying || !isReady) return;
    const t = getPlayheadTime();
    const dur = Math.max(rulerProps.durationSec, 1e-6);
    const leftPct = Math.max(-1, Math.min(101, (t / dur) * 100));
    const pct = `${leftPct}%`;
    const line = playheadLineRef.current;
    if (line) {
      line.setAttribute("x1", pct);
      line.setAttribute("x2", pct);
    }
  }, [getPlayheadTime, isPlaying, isReady, rulerProps.durationSec]);

  return (
    <WaveformTimeRuler
      {...rulerProps}
      currentTimeSec={displayTimeSec}
      playheadLineRef={playheadLineRef}
      hidePlayheadReact={isPlaying}
    />
  );
});
