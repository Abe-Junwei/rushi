import { useCallback, useLayoutEffect, useMemo, useReducer, useRef } from "react";
import {
  buildVisibleRulerTicks,
  computeEmbeddedRulerLabelStride,
  findHighlightedRulerMajorTickTime,
} from "../services/waveform/waveformRulerTicks";
import { subscribeTierScrollFrame } from "../utils/tierScrollFrameCoordinator";
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

const TICK_WINDOW_REBUILD_SCROLL_EPSILON_PX = 1;

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

  const tickWindowRef = useRef({ scrollLeftPx: 0, viewportWidthPx: 1 });
  const [, bumpTickWindow] = useReducer((n: number) => n + 1, 0);

  useLayoutEffect(() => {
    if (!viewportSpace) return;
    const scrollEl = tierScrollRef?.current;
    if (!scrollEl) return;

    const commitTickWindow = (scrollLeftPx: number, viewportWidthPx: number) => {
      tickWindowRef.current = { scrollLeftPx, viewportWidthPx };
      bumpTickWindow();
    };

    commitTickWindow(scrollEl.scrollLeft, Math.max(1, scrollEl.clientWidth));

    let lastRebuildScrollPx = scrollEl.scrollLeft;
    let lastRebuildViewportWidthPx = Math.max(1, scrollEl.clientWidth);
    let rebuildRaf = 0;

    const scheduleRebuildIfNeeded = () => {
      const scrollLeftPx = scrollEl.scrollLeft;
      const viewportWidthPx = Math.max(1, scrollEl.clientWidth);
      const scrollMoved = Math.abs(scrollLeftPx - lastRebuildScrollPx) >= TICK_WINDOW_REBUILD_SCROLL_EPSILON_PX;
      const viewportResized = viewportWidthPx !== lastRebuildViewportWidthPx;
      if (!scrollMoved && !viewportResized) return;
      if (rebuildRaf) return;
      rebuildRaf = requestAnimationFrame(() => {
        rebuildRaf = 0;
        lastRebuildScrollPx = scrollEl.scrollLeft;
        lastRebuildViewportWidthPx = Math.max(1, scrollEl.clientWidth);
        commitTickWindow(lastRebuildScrollPx, lastRebuildViewportWidthPx);
      });
    };

    scrollEl.addEventListener("scroll", scheduleRebuildIfNeeded, { passive: true });
    window.addEventListener("resize", scheduleRebuildIfNeeded);
    const unsubscribeFrame = subscribeTierScrollFrame(scheduleRebuildIfNeeded);

    return () => {
      scrollEl.removeEventListener("scroll", scheduleRebuildIfNeeded);
      window.removeEventListener("resize", scheduleRebuildIfNeeded);
      unsubscribeFrame();
      if (rebuildRaf) cancelAnimationFrame(rebuildRaf);
    };
  }, [viewportSpace, tierScrollRef, timelineWidthPx, durationSec]);

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

  const tickWindowScrollLeftPx = tickWindowRef.current.scrollLeftPx;
  const tickWindowViewportWidthPx = tickWindowRef.current.viewportWidthPx;

  const renderWidthPx = scrollClipMode
    ? timelineWidthPx
    : viewportSpace
      ? Math.max(1, tickWindowViewportWidthPx)
      : timelineWidthPx;
  const tickLayerViewportSpace = scrollClipMode ? false : viewportSpace;

  const visibleView = useMemo(() => {
    const base = {
      scrollLeftPx: viewportSpace ? tickWindowScrollLeftPx : liveScrollLeftPx,
      viewportWidthPx: viewportSpace ? tickWindowViewportWidthPx : liveViewportWidthPx,
      timelineWidthPx,
      durationSec,
    };
    if (scrollClipMode || viewportSpace) {
      return paddedVisibleTimeWindow(base);
    }
    return visibleTimeWindowFromScroll(base);
  }, [
    durationSec,
    liveScrollLeftPx,
    liveViewportWidthPx,
    scrollClipMode,
    tickWindowScrollLeftPx,
    tickWindowViewportWidthPx,
    timelineWidthPx,
    viewportSpace,
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
        return px - Math.max(0, tickWindowScrollLeftPx);
      }
      return px;
    },
    [durationSec, tickLayerViewportSpace, tickWindowScrollLeftPx, timelineWidthPx],
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
    renderWidthPx,
    tickLayerViewportSpace,
    ticks,
    majorTicks,
    embeddedLabelStride,
    highlightedMajorTickTime,
    timelineToDisplayPx,
    playheadLeft,
    liveScrollLeftPx,
    /** ScrollLeft frozen at last tick-window rebuild — imperative translate delta base. */
    tickLayerBaseScrollLeftPx: tickLayerViewportSpace ? tickWindowScrollLeftPx : 0,
  };
}
