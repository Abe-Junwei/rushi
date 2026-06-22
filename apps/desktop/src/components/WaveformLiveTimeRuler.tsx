import { memo } from "react";
import { useWaveformLiveClock } from "../hooks/useWaveformLiveClock";
import { WaveformTimeRulerCanvas, type WaveformTimeRulerCanvasProps } from "./WaveformTimeRulerCanvas";

type WaveformLiveTimeRulerProps = Omit<
  WaveformTimeRulerCanvasProps,
  "currentTimeSec" | "getPlayheadTimeSec"
> & {
  isPlaying: boolean;
  isReady: boolean;
  currentTimeSec: number;
  getDisplayPlayheadTimeSec: () => number;
  subscribePlayheadFrame?: WaveformTimeRulerCanvasProps["subscribePlayheadFrame"];
};

/** 播放期 rAF 节流标尺时间标签；播放头由 {@link WaveformViewportPlayhead} 承担。 */
export const WaveformLiveTimeRuler = memo(function WaveformLiveTimeRuler({
  isPlaying,
  isReady,
  currentTimeSec,
  getDisplayPlayheadTimeSec,
  formatMediaTime,
  durationSec,
  timelineWidthPx,
  subscribePlayheadFrame,
  ...canvasProps
}: WaveformLiveTimeRulerProps) {
  const { displayTimeSec } = useWaveformLiveClock({
    isPlaying,
    isReady,
    currentTimeSec,
    getDisplayPlayheadTimeSec,
    formatMediaTime,
    durationSec,
    timelineWidthPx,
    subscribePlayheadFrame,
  });

  return (
    <WaveformTimeRulerCanvas
      {...canvasProps}
      durationSec={durationSec}
      timelineWidthPx={timelineWidthPx}
      isReady={isReady}
      subscribePlayheadFrame={subscribePlayheadFrame}
      formatMediaTime={formatMediaTime}
      currentTimeSec={displayTimeSec}
      getPlayheadTimeSec={getDisplayPlayheadTimeSec}
    />
  );
});
