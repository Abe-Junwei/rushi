import { memo, useCallback, useLayoutEffect, useRef, type RefObject } from "react";
import { subscribeAppAppearance } from "../services/ui/appAppearance";
import {
  drawWaveformTimeRuler,
  WAVEFORM_EMBEDDED_RULER_HEIGHT_PX,
} from "../services/waveform/drawWaveformTimeRuler";
import { useWaveformTimeRulerInteraction } from "../hooks/useWaveformTimeRulerInteraction";
import {
  resolveTierViewportMetrics,
  type TierScrollLayoutMetrics,
  type TierScrollLiveRefs,
} from "../utils/waveformViewport";
import { scheduleTierScrollFrame, subscribeTierScrollFrame } from "../utils/tierScrollFrameCoordinator";
import { setCspLayoutRules } from "../utils/cspElementLayout";
import {
  defaultWaveformRulerCanvasPalette,
  readWaveformRulerCanvasPalette,
  type WaveformRulerCanvasPalette,
} from "../utils/waveformRulerCanvasColors";
import { CspLayout } from "./CspLayout";

export { WAVEFORM_EMBEDDED_RULER_HEIGHT_PX };

export type WaveformTimeRulerCanvasProps = {
  durationSec: number;
  timelineWidthPx: number;
  viewportWidthPx?: number;
  isReady?: boolean;
  tierScrollRef: RefObject<HTMLElement | null>;
  tierScrollLive: TierScrollLiveRefs;
  tierScrollLayout: TierScrollLayoutMetrics;
  currentTimeSec: number;
  getPlayheadTimeSec?: () => number;
  formatMediaTime: (sec: number) => string;
  disabled?: boolean;
  /** Local ruler repaint only — must not call flushTierScrollFrame (scroll snap-back). */
  subscribePlayheadFrame?: (cb: (timeSec: number) => void) => () => void;
  onSeekFromTierClientX: (clientX: number) => void;
  onSetScrollLeftPx: (px: number) => void;
};

export const WaveformTimeRulerCanvas = memo(function WaveformTimeRulerCanvas({
  durationSec,
  timelineWidthPx,
  viewportWidthPx = 0,
  isReady = true,
  tierScrollRef,
  tierScrollLive,
  tierScrollLayout,
  currentTimeSec,
  getPlayheadTimeSec,
  formatMediaTime,
  disabled,
  subscribePlayheadFrame,
  onSeekFromTierClientX,
  onSetScrollLeftPx,
}: WaveformTimeRulerCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const paletteRef = useRef<WaveformRulerCanvasPalette>(defaultWaveformRulerCanvasPalette());
  const inputRef = useRef({
    durationSec,
    timelineWidthPx,
    viewportWidthPx,
    currentTimeSec,
    getPlayheadTimeSec,
    formatMediaTime,
    interactionActive: false,
  });
  inputRef.current = {
    durationSec,
    timelineWidthPx,
    viewportWidthPx,
    currentTimeSec,
    getPlayheadTimeSec,
    formatMediaTime,
    interactionActive: inputRef.current.interactionActive,
  };

  const tierMetricsRef = useRef({ tierScrollRef, tierScrollLive, tierScrollLayout });
  tierMetricsRef.current = { tierScrollRef, tierScrollLive, tierScrollLayout };

  const liveScrollLeftRef = useRef(0);
  const getLiveScrollLeftPx = useCallback(() => {
    const tierMetrics = tierMetricsRef.current;
    return resolveTierViewportMetrics({
      tierScrollEl: tierMetrics.tierScrollRef.current,
      tierScrollLive: tierMetrics.tierScrollLive,
      tierScrollLayout: tierMetrics.tierScrollLayout,
    }).scrollLeftPx;
  }, []);
  const { interactionActive, onRulerPointerDown } = useWaveformTimeRulerInteraction({
    embedded: true,
    currentTimeSec,
    liveScrollLeftPx: liveScrollLeftRef.current,
    getLiveScrollLeftPx,
    disabled,
    onSeekFromTierClientX,
    onSetScrollLeftPx,
  });
  inputRef.current.interactionActive = interactionActive;

  const paintRef = useRef<(() => void) | null>(null);
  const lastCanvasDimsRef = useRef({ devW: 0, devH: 0, cssW: 0, cssH: 0 });

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const paint = () => {
      const input = inputRef.current;
      const tierMetrics = tierMetricsRef.current;
      const metrics = resolveTierViewportMetrics({
        tierScrollEl: tierMetrics.tierScrollRef.current,
        tierScrollLive: tierMetrics.tierScrollLive,
        tierScrollLayout: tierMetrics.tierScrollLayout,
      });
      liveScrollLeftRef.current = metrics.scrollLeftPx;

      const widthPx = Math.max(
        1,
        Math.floor(Math.max(metrics.viewportWidthPx, input.viewportWidthPx)),
      );
      const heightPx = WAVEFORM_EMBEDDED_RULER_HEIGHT_PX;
      const dpr = window.devicePixelRatio || 1;
      const devW = Math.max(1, Math.floor(widthPx * dpr));
      const devH = Math.max(1, Math.floor(heightPx * dpr));
      const dims = lastCanvasDimsRef.current;
      if (dims.devW !== devW || dims.devH !== devH) {
        canvas.width = devW;
        canvas.height = devH;
        dims.devW = devW;
        dims.devH = devH;
      }
      if (dims.cssW !== widthPx || dims.cssH !== heightPx) {
        setCspLayoutRules(canvas, { width: widthPx, height: heightPx });
        dims.cssW = widthPx;
        dims.cssH = heightPx;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const paintTimeSec = input.getPlayheadTimeSec?.() ?? input.currentTimeSec;
      drawWaveformTimeRuler({
        ctx,
        scrollLeftPx: metrics.scrollLeftPx,
        viewportWidthPx: widthPx,
        timelineWidthPx: input.timelineWidthPx,
        durationSec: input.durationSec,
        currentTimeSec: paintTimeSec,
        formatMediaTime: input.formatMediaTime,
        interactionActive: input.interactionActive,
        palette: paletteRef.current,
      });
    };

    paintRef.current = paint;

    paletteRef.current = readWaveformRulerCanvasPalette();
    paint();
    const layoutRaf = requestAnimationFrame(() => paint());
    const unsubFrame = subscribeTierScrollFrame(paint);
    const onResize = () => scheduleTierScrollFrame();
    window.addEventListener("resize", onResize);
    const unsubAppearance = subscribeAppAppearance(() => {
      paletteRef.current = readWaveformRulerCanvasPalette();
      paintRef.current?.();
    });
    const unsubPlayhead = subscribePlayheadFrame?.(() => {
      paintRef.current?.();
    });

    return () => {
      unsubAppearance();
      unsubFrame();
      unsubPlayhead?.();
      cancelAnimationFrame(layoutRaf);
      paintRef.current = null;
      window.removeEventListener("resize", onResize);
    };
  }, [
    tierScrollRef,
    tierScrollLayout.clientWidthPx,
    viewportWidthPx,
    subscribePlayheadFrame,
  ]);

  useLayoutEffect(() => {
    paintRef.current?.();
  }, [durationSec, timelineWidthPx, viewportWidthPx, currentTimeSec, formatMediaTime, interactionActive]);

  if (!isReady || durationSec <= 0 || timelineWidthPx <= 0) {
    return null;
  }

  return (
    <CspLayout
      className="waveform-embedded-time-ruler pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[22px] overflow-hidden bg-transparent"
      layout={{ width: "100%", height: WAVEFORM_EMBEDDED_RULER_HEIGHT_PX }}
    >
      <div
        className={`relative z-[1] h-[22px] w-full bg-transparent ${disabled ? "pointer-events-none opacity-50" : "pointer-events-auto"} cursor-grab select-none active:cursor-grabbing`}
        onPointerDown={onRulerPointerDown}
      >
        <canvas
          ref={canvasRef}
          className="waveform-time-ruler-canvas pointer-events-none absolute left-0 top-0 z-[1]"
          aria-hidden
        />
      </div>
    </CspLayout>
  );
});
