import { memo, useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  buildVisibleRulerTicks,
  computeEmbeddedRulerLabelStride,
  findHighlightedRulerMajorTickTime,
} from "../services/waveform/waveformRulerTicks";
import {
  resolveTierViewportMetrics,
  type TierScrollLayoutMetrics,
  type TierScrollLiveRefs,
} from "../utils/waveformViewport";
import {
  effectiveTimelinePxPerSec,
  playheadViewportLeftPx,
  timeToTimelinePx,
  visibleTimeWindowFromScroll,
} from "../utils/waveformProjection";
import { WaveformTimeRulerTickLayer } from "./WaveformTimeRulerTickLayer";

export type WaveformTimeRulerProps = {
  durationSec: number;
  timelineWidthPx: number;
  /** Committed tier layout — scroll/viewport reads go through resolveTierViewportMetrics. */
  tierScrollLayout: TierScrollLayoutMetrics;
  tierScrollLive?: TierScrollLiveRefs;
  tierScrollRef?: React.RefObject<HTMLElement | null>;
  /** Legacy fallbacks when tierScrollLayout is absent (unused in embedded viewport). */
  scrollLeftPx?: number;
  viewportWidthPx?: number;
  /** Retained for API compat; tick density uses effectiveTimelinePxPerSec. */
  pxPerSec: number;
  currentTimeSec: number;
  formatMediaTime: (sec: number) => string;
  disabled?: boolean;
  /** ink：深色条上（默认）；light：浅色独立条；embedded：嵌入波形底部 */
  appearance?: "ink" | "light" | "embedded";
  /** timeline：随宽内容滚动；viewport：sticky 视口宽标尺（embedded 推荐） */
  coordinateSpace?: "timeline" | "viewport";
  /** 点击时间尺（相对 tier 视口）寻位 */
  onSeekFromTierClientX: (clientX: number) => void;
  onSetScrollLeftPx: (px: number) => void;
  /** 播放期由 rAF 直写 playhead，避免 React 每帧重绘 */
  playheadLineRef?: React.RefObject<SVGLineElement | null>;
  hidePlayheadReact?: boolean;
};

export const WAVEFORM_EMBEDDED_TIME_RULER_H_PX = 22;
const RULER_H = WAVEFORM_EMBEDDED_TIME_RULER_H_PX;

export const WaveformTimeRuler = memo(function WaveformTimeRuler({
  durationSec,
  timelineWidthPx,
  tierScrollLayout,
  scrollLeftPx: _scrollLeftPxProp = 0,
  viewportWidthPx: _viewportWidthPxProp = 0,
  pxPerSec: _pxPerSec,
  currentTimeSec,
  formatMediaTime,
  disabled,
  onSeekFromTierClientX,
  onSetScrollLeftPx,
  appearance = "ink",
  coordinateSpace = "timeline",
  tierScrollLive,
  tierScrollRef,
  playheadLineRef,
  hidePlayheadReact = false,
}: WaveformTimeRulerProps) {
  const ink = appearance === "ink";
  const embedded = appearance === "embedded";
  const viewportSpace = coordinateSpace === "viewport";
  const [, bumpScrollFrame] = useReducer((n: number) => n + 1, 0);

  const tierMetrics = resolveTierViewportMetrics({
    tierScrollEl: tierScrollRef?.current ?? null,
    tierScrollLive,
    tierScrollLayout,
  });
  const liveScrollLeftPx = tierMetrics.scrollLeftPx;
  const liveViewportWidthPx = tierMetrics.viewportWidthPx;

  useEffect(() => {
    if (!viewportSpace) return;
    const scrollEl = tierScrollRef?.current;
    if (!scrollEl) return;
    let raf = 0;
    const scheduleBump = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        bumpScrollFrame();
      });
    };
    scrollEl.addEventListener("scroll", scheduleBump, { passive: true });
    window.addEventListener("resize", scheduleBump);
    return () => {
      scrollEl.removeEventListener("scroll", scheduleBump);
      window.removeEventListener("resize", scheduleBump);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [tierScrollRef, viewportSpace]);

  const renderWidthPx = viewportSpace ? Math.max(1, liveViewportWidthPx) : timelineWidthPx;
  const rulerDragRef = useRef({ dragging: false, startX: 0, startScroll: 0 });
  const scrollLeftPxRef = useRef(liveScrollLeftPx);
  scrollLeftPxRef.current = liveScrollLeftPx;
  const prevCurrentTimeRef = useRef<number | null>(null);
  const interactionFadeTimeoutRef = useRef<number | null>(null);
  const [interactionActive, setInteractionActive] = useState(false);
  const visibleView = useMemo(
    () =>
      visibleTimeWindowFromScroll({
        scrollLeftPx: liveScrollLeftPx,
        viewportWidthPx: liveViewportWidthPx,
        timelineWidthPx,
        durationSec,
      }),
    [durationSec, liveScrollLeftPx, liveViewportWidthPx, timelineWidthPx],
  );

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

  useEffect(() => {
    if (!embedded) return;
    const prev = prevCurrentTimeRef.current;
    prevCurrentTimeRef.current = currentTimeSec;
    if (prev == null || Math.abs(currentTimeSec - prev) < 1e-4) return;
    setInteractionActive(true);
    if (interactionFadeTimeoutRef.current != null) {
      window.clearTimeout(interactionFadeTimeoutRef.current);
    }
    interactionFadeTimeoutRef.current = window.setTimeout(() => {
      interactionFadeTimeoutRef.current = null;
      setInteractionActive(false);
    }, 260);
    return () => {
      if (interactionFadeTimeoutRef.current != null) {
        window.clearTimeout(interactionFadeTimeoutRef.current);
        interactionFadeTimeoutRef.current = null;
      }
    };
  }, [currentTimeSec, embedded]);

  const timelineToDisplayPx = useCallback(
    (timeSec: number) => {
      const px = timeToTimelinePx(timeSec, timelineWidthPx, durationSec);
      return viewportSpace ? px - Math.max(0, liveScrollLeftPx) : px;
    },
    [durationSec, liveScrollLeftPx, timelineWidthPx, viewportSpace],
  );

  const playheadLeft = useMemo(() => {
    if (viewportSpace) {
      const px = playheadViewportLeftPx(
        currentTimeSec,
        liveScrollLeftPx,
        timelineWidthPx,
        durationSec,
      );
      return `${px}px`;
    }
    const dur = Math.max(durationSec, 1e-6);
    const p = (currentTimeSec / dur) * 100;
    return `${Math.max(-1, Math.min(101, p))}%`;
  }, [currentTimeSec, durationSec, liveScrollLeftPx, timelineWidthPx, viewportSpace]);

  const onRulerPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled || e.button !== 0) return;
      rulerDragRef.current = { dragging: false, startX: e.clientX, startScroll: scrollLeftPxRef.current };
      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - rulerDragRef.current.startX;
        if (Math.abs(dx) > 3) rulerDragRef.current.dragging = true;
        if (rulerDragRef.current.dragging) {
          onSetScrollLeftPx(rulerDragRef.current.startScroll - dx);
        }
      };
      const onUp = (ev: PointerEvent) => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        window.removeEventListener("blur", onBlur);
        if (!rulerDragRef.current.dragging) {
          onSeekFromTierClientX(ev.clientX);
        }
        rulerDragRef.current.dragging = false;
      };
      const onBlur = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        window.removeEventListener("blur", onBlur);
        rulerDragRef.current.dragging = false;
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
      window.addEventListener("blur", onBlur);
    },
    [disabled, onSeekFromTierClientX, onSetScrollLeftPx],
  );

  if (durationSec <= 0 || timelineWidthPx <= 0) {
    return null;
  }

  return (
    <div
      className={
        embedded
          ? "relative shrink-0"
          : ink
          ? "relative shrink-0 border-t border-zen-paper/10 bg-zen-ink/25"
          : "relative shrink-0 border-t border-zen-ink/10 bg-zen-paper"
      }
      style={{ width: renderWidthPx, height: RULER_H }}
    >
      {embedded ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-t from-notion-sidebar/40 via-transparent to-transparent"
        />
      ) : null}
      <div
        className={`relative z-[1] h-[22px] cursor-grab select-none active:cursor-grabbing ${disabled ? "pointer-events-none opacity-50" : ""}`}
        onPointerDown={onRulerPointerDown}
      >
        <WaveformTimeRulerTickLayer
          ticks={ticks}
          majorTicks={majorTicks}
          embeddedLabelStride={embeddedLabelStride}
          viewportSpace={viewportSpace}
          renderWidthPx={renderWidthPx}
          durationSec={durationSec}
          embedded={embedded}
          ink={ink}
          interactionActive={interactionActive}
          highlightedMajorTickTime={highlightedMajorTickTime}
          timelineToDisplayPx={timelineToDisplayPx}
          formatMediaTime={formatMediaTime}
          playheadLineRef={playheadLineRef}
          hidePlayheadReact={hidePlayheadReact}
          playheadLeft={playheadLeft}
          rulerHeightPx={RULER_H}
        />
      </div>
    </div>
  );
});
