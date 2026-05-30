import { memo, useCallback, useEffect, useRef } from "react";
import { WaveformTimeRuler, type WaveformTimeRulerProps } from "./WaveformTimeRuler";
import { useWaveformLiveClock } from "../hooks/useWaveformLiveClock";
import { playheadTimelineLeftPct, playheadViewportLeftPx } from "../utils/waveformProjection";

type WaveformLiveTimeRulerProps = Omit<WaveformTimeRulerProps, "currentTimeSec"> & {
  isPlaying: boolean;
  isReady: boolean;
  getPlayheadTime: () => number;
};

function resolveLiveScrollLeftPx(
  scrollLeftPx: number,
  coordinateSpace: WaveformTimeRulerProps["coordinateSpace"],
  tierScrollLive?: WaveformTimeRulerProps["tierScrollLive"],
): number {
  const live = tierScrollLive?.scrollLeftRef.current;
  if (coordinateSpace === "viewport" && live != null) {
    return live;
  }
  return scrollLeftPx;
}

/** 播放期 rAF 驱动 playhead，减少父级 currentTime 导致的整树重绘。 */
export const WaveformLiveTimeRuler = memo(function WaveformLiveTimeRuler({
  isPlaying,
  isReady,
  getPlayheadTime,
  ...rulerProps
}: WaveformLiveTimeRulerProps) {
  const playheadLineRef = useRef<SVGLineElement | null>(null);
  const viewportSpace = rulerProps.coordinateSpace === "viewport";
  const rulerPropsRef = useRef(rulerProps);
  rulerPropsRef.current = rulerProps;

  const writePlayheadLine = useCallback((timeSec: number) => {
    const line = playheadLineRef.current;
    if (!line) return;
    const props = rulerPropsRef.current;
    if (viewportSpace) {
      const scrollLeftPx = resolveLiveScrollLeftPx(
        props.scrollLeftPx,
        props.coordinateSpace,
        props.tierScrollLive,
      );
      const px = playheadViewportLeftPx(
        timeSec,
        scrollLeftPx,
        props.timelineWidthPx,
        props.durationSec,
      );
      const x = `${px}px`;
      line.setAttribute("x1", x);
      line.setAttribute("x2", x);
      return;
    }
    const leftPct = playheadTimelineLeftPct(timeSec, props.timelineWidthPx, props.durationSec);
    const pct = `${leftPct}%`;
    line.setAttribute("x1", pct);
    line.setAttribute("x2", pct);
  }, [viewportSpace]);

  const onPlayheadMove = useCallback(
    (t: number, _leftPct: number) => {
      writePlayheadLine(t);
    },
    [writePlayheadLine],
  );

  const { displayTimeSec } = useWaveformLiveClock({
    isPlaying,
    isReady,
    getPlayheadTime,
    formatMediaTime: rulerProps.formatMediaTime,
    durationSec: rulerProps.durationSec,
    timelineWidthPx: rulerProps.timelineWidthPx,
    onPlayheadMove: isPlaying ? onPlayheadMove : undefined,
  });

  useEffect(() => {
    if (isPlaying || !isReady) return;
    writePlayheadLine(getPlayheadTime());
  }, [
    getPlayheadTime,
    isPlaying,
    isReady,
    rulerProps.durationSec,
    rulerProps.scrollLeftPx,
    rulerProps.timelineWidthPx,
    writePlayheadLine,
  ]);

  return (
    <WaveformTimeRuler
      {...rulerProps}
      currentTimeSec={displayTimeSec}
      playheadLineRef={playheadLineRef}
      hidePlayheadReact={isPlaying}
    />
  );
});
