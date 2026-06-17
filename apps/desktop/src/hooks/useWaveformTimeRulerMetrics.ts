import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  buildVisibleRulerTicks,
  computeEmbeddedRulerLabelStride,
  findHighlightedRulerMajorTickTime,
} from "../services/waveform/waveformRulerTicks";
import { useWaveformRulerScrollTrack, applyWaveformRulerScrollTrackTransform } from "./useWaveformRulerScrollTrack";
import {
  resolveTierViewportMetrics,
  type TierScrollLayoutMetrics,
  type TierScrollLiveRefs,
} from "../utils/waveformViewport";
import {
  effectiveTimelinePxPerSec,
  embeddedRulerPlayheadUsesTimelineCoords,
  paddedVisibleTimeWindow,
  playheadViewportLeftPx,
  timeToTimelinePx,
  visibleTimeWindowFromScroll,
} from "../utils/waveformProjection";

export type UseWaveformTimeRulerMetricsArgs = {
  durationSec: number;
  timelineWidthPx: number;
  tierScrollLayout: TierScrollLayoutMetrics;
  tierScrollLive?: TierScrollLiveRefs;
  tierScrollRef?: React.RefObject<HTMLElement | null>;
  appearance?: "ink" | "light" | "embedded";
  coordinateSpace?: "timeline" | "viewport";
  overlayOnWaveform?: boolean;
  currentTimeSec: number;
};

export function useWaveformTimeRulerMetrics({
  durationSec,
  timelineWidthPx,
  tierScrollLayout,
  tierScrollLive,
  tierScrollRef,
  appearance = "ink",
  coordinateSpace = "timeline",
  overlayOnWaveform = false,
  currentTimeSec,
}: UseWaveformTimeRulerMetricsArgs) {
  const ink = appearance === "ink";
  const embedded = appearance === "embedded";
  const embeddedOverlay = embedded && overlayOnWaveform;
  const scrollTrackPlayhead = embeddedRulerPlayheadUsesTimelineCoords({
    appearance,
    coordinateSpace,
    overlayOnWaveform,
  });
  const viewportSpace = coordinateSpace === "viewport" && !scrollTrackPlayhead;
  const scrollClipMode = scrollTrackPlayhead;
  const scrollTrackRef = useRef<HTMLDivElement | null>(null);
  const [, bumpScrollFrame] = useReducer((n: number) => n + 1, 0);
  const [tickBuildScrollLeftPx, setTickBuildScrollLeftPx] = useState(
    () => tierScrollLayout.scrollLeftPx,
  );

  const onTickRebuild = useCallback((scrollLeftPx: number) => {
    setTickBuildScrollLeftPx(scrollLeftPx);
  }, []);

  useWaveformRulerScrollTrack({
    enabled: scrollClipMode,
    tierScrollRef,
    tierScrollLive,
    scrollTrackRef,
    timelineWidthPx,
    onTickRebuild,
  });

  useEffect(() => {
    if (scrollClipMode) return;
    if (!viewportSpace) return;
    const scrollEl = tierScrollRef?.current;
    if (!scrollEl) return;
    const scheduleBump = () => {
      bumpScrollFrame();
    };
    scrollEl.addEventListener("scroll", scheduleBump, { passive: true });
    window.addEventListener("resize", scheduleBump);
    return () => {
      scrollEl.removeEventListener("scroll", scheduleBump);
      window.removeEventListener("resize", scheduleBump);
    };
  }, [scrollClipMode, tierScrollRef, viewportSpace]);

  useEffect(() => {
    if (!scrollClipMode) return;
    setTickBuildScrollLeftPx(tierScrollLayout.scrollLeftPx);
  }, [scrollClipMode, tierScrollLayout.scrollLeftPx, timelineWidthPx, durationSec]);

  const tierMetrics = resolveTierViewportMetrics({
    tierScrollEl: tierScrollRef?.current ?? null,
    tierScrollLive,
    tierScrollLayout,
  });
  const scrollEl = tierScrollRef?.current;
  const liveScrollLeftPx =
    scrollEl != null ? scrollEl.scrollLeft : tierMetrics.scrollLeftPx;
  const liveViewportWidthPx =
    scrollEl != null ? Math.max(1, scrollEl.clientWidth) : tierMetrics.viewportWidthPx;

  const renderWidthPx = scrollClipMode
    ? timelineWidthPx
    : viewportSpace
      ? Math.max(1, liveViewportWidthPx)
      : timelineWidthPx;
  const tickLayerViewportSpace = scrollClipMode ? false : viewportSpace;

  const visibleView = useMemo(() => {
    const base = {
      scrollLeftPx: liveScrollLeftPx,
      viewportWidthPx: liveViewportWidthPx,
      timelineWidthPx,
      durationSec,
    };
    return scrollClipMode ? paddedVisibleTimeWindow(base) : visibleTimeWindowFromScroll(base);
  }, [
    durationSec,
    liveScrollLeftPx,
    liveViewportWidthPx,
    scrollClipMode,
    timelineWidthPx,
  ]);

  const tickPxPerSec = useMemo(
    () => effectiveTimelinePxPerSec(timelineWidthPx, durationSec),
    [durationSec, timelineWidthPx],
  );

  const { ticks, majorStep } = useMemo(
    () =>
      buildVisibleRulerTicks({
        durationSec,
        tickPxPerSec,
        visibleStart: visibleView.start,
        visibleEnd: visibleView.end,
      }),
    [durationSec, tickPxPerSec, visibleView.end, visibleView.start],
  );

  useLayoutEffect(() => {
    if (!scrollClipMode) return;
    applyWaveformRulerScrollTrackTransform(
      tierScrollRef?.current ?? null,
      scrollTrackRef.current,
      tierScrollLive,
    );
  }, [scrollClipMode, tickBuildScrollLeftPx, ticks.length, tierScrollLive, tierScrollRef, timelineWidthPx]);

  const majorTicks = useMemo(() => ticks.filter((tick) => tick.major), [ticks]);
  const embeddedLabelStride = useMemo(
    () => computeEmbeddedRulerLabelStride(embedded, majorStep, tickPxPerSec),
    [embedded, majorStep, tickPxPerSec],
  );
  const highlightedMajorTickTime = useMemo(() => {
    if (!embedded) return null;
    return findHighlightedRulerMajorTickTime(majorTicks, currentTimeSec, majorStep);
  }, [currentTimeSec, embedded, majorStep, majorTicks]);

  const timelineToDisplayPx = useCallback(
    (timeSec: number) => {
      const px = timeToTimelinePx(timeSec, timelineWidthPx, durationSec);
      if (tickLayerViewportSpace) {
        return px - Math.max(0, liveScrollLeftPx);
      }
      return px;
    },
    [durationSec, liveScrollLeftPx, tickLayerViewportSpace, timelineWidthPx],
  );

  const playheadLeft = useMemo(() => {
    if (viewportSpace) {
      const scrollLeftPx = scrollEl?.scrollLeft ?? liveScrollLeftPx;
      const px = playheadViewportLeftPx(
        currentTimeSec,
        scrollLeftPx,
        timelineWidthPx,
        durationSec,
      );
      return `${px}px`;
    }
    const dur = Math.max(durationSec, 1e-6);
    const p = (currentTimeSec / dur) * 100;
    return `${Math.max(-1, Math.min(101, p))}%`;
  }, [currentTimeSec, durationSec, liveScrollLeftPx, scrollEl, timelineWidthPx, viewportSpace]);

  return {
    ink,
    embedded,
    embeddedOverlay,
    scrollClipMode,
    scrollTrackRef,
    renderWidthPx,
    tickLayerViewportSpace,
    ticks,
    majorTicks,
    embeddedLabelStride,
    highlightedMajorTickTime,
    timelineToDisplayPx,
    playheadLeft,
    liveScrollLeftPx,
  };
}
