import { useRef, type RefObject } from "react";
import {
  PX_PER_SEC_MAX,
  PX_PER_SEC_MIN,
  resolveWaveformZoomSliderRange,
} from "../utils/pxPerSec";
import { computeZoomInPxPerSec, computeZoomOutPxPerSec } from "../utils/waveformZoomSlider";
import type { useWaveformTimelineController } from "../hooks/useWaveformTimelineController";

type TimelineApi = ReturnType<typeof useWaveformTimelineController>;

export function useWaveformZoomStepController(
  timelineRef: RefObject<{ timeline: TimelineApi }>,
) {
  const stepWaveformZoomRef = useRef<(direction: "in" | "out") => void>(() => {});
  stepWaveformZoomRef.current = (direction) => {
    const { timeline: tl } = timelineRef.current;
    const tier = tl.tierScrollRef.current;
    const dur = tl.timelineMetrics.mediaDurationSec;
    const vw = tier?.clientWidth ?? 0;
    const px = tl.pxPerSec;
    const sliderRange =
      vw > 0 && dur >= 0.5
        ? resolveWaveformZoomSliderRange(vw, dur)
        : { minPxPerSec: PX_PER_SEC_MIN, maxPxPerSec: PX_PER_SEC_MAX };
    const next =
      direction === "in"
        ? computeZoomInPxPerSec(px, sliderRange)
        : computeZoomOutPxPerSec(px, sliderRange);
    if (Math.abs(next - px) < 0.001) return;
    tl.zoom.setPxPerSecFromSlider(next);
  };
  return stepWaveformZoomRef;
}
