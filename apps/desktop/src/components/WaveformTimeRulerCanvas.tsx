import { memo, useCallback, useLayoutEffect, useRef, type RefObject } from "react";
import { subscribeAppAppearance } from "../services/ui/appAppearance";
import {
  drawWaveformTimeRuler,
  WAVEFORM_EMBEDDED_RULER_HEIGHT_PX,
} from "../services/waveform/drawWaveformTimeRuler";
import { useWaveformTimeRulerInteraction } from "../hooks/useWaveformTimeRulerInteraction";
import {
  resolveTierViewportMetricsDuringScrollFrame,
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
import {
  waveformScrollProfileRulerRepaint,
  waveformScrollProfileRulerSkipped,
} from "../services/waveform/waveformScrollProfile";
import {
  computeSegmentBandCanvasWindow,
  cspLayoutLeftPxIfChanged,
  segmentBandCanvasNeedsRepaint,
} from "../utils/waveformSegmentBandCanvasScroll";
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
  /** R2: click centers tier scroll — no seek. */
  onCenterTierAtClientX: (clientX: number) => void;
  onSetScrollLeftPx: (px: number) => void;
};

function rulerPaintable(input: {
  isReady: boolean;
  durationSec: number;
  timelineWidthPx: number;
}): boolean {
  return input.isReady && input.durationSec > 0 && input.timelineWidthPx > 0;
}

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
  onCenterTierAtClientX,
  onSetScrollLeftPx,
}: WaveformTimeRulerCanvasProps) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const paletteRef = useRef<WaveformRulerCanvasPalette>(defaultWaveformRulerCanvasPalette());
  const inputRef = useRef({
    isReady,
    durationSec,
    timelineWidthPx,
    viewportWidthPx,
    currentTimeSec,
    getPlayheadTimeSec,
    formatMediaTime,
    interactionActive: false,
  });
  inputRef.current = {
    isReady,
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
    return resolveTierViewportMetricsDuringScrollFrame({
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
    onCenterTierAtClientX,
    onSetScrollLeftPx,
  });
  inputRef.current.interactionActive = interactionActive;

  const paintRef = useRef<(() => void) | null>(null);
  const forceRepaintRef = useRef(true);
  const lastCanvasDimsRef = useRef({ devW: 0, devH: 0, cssW: 0, cssH: 0, dpr: 0 });
  const lastPaintWindowRef = useRef({
    leftPx: -1,
    widthPx: 0,
    heightPx: 0,
    bufferPx: 0,
  });
  const lastShellLeftRef = useRef<number | null>(null);

  const invalidatePaintWindow = () => {
    lastPaintWindowRef.current = { leftPx: -1, widthPx: 0, heightPx: 0, bufferPx: 0 };
    lastShellLeftRef.current = null;
  };

  const paintable = rulerPaintable({ isReady, durationSec, timelineWidthPx });

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const shell = shellRef.current;
    if (!canvas || !shell) return;

    const paint = () => {
      const input = inputRef.current;
      const tierMetrics = tierMetricsRef.current;
      const metrics = resolveTierViewportMetricsDuringScrollFrame({
        tierScrollEl: tierMetrics.tierScrollRef.current,
        tierScrollLive: tierMetrics.tierScrollLive,
        tierScrollLayout: tierMetrics.tierScrollLayout,
      });
      liveScrollLeftRef.current = metrics.scrollLeftPx;

      const viewportWidth = Math.max(
        1,
        Math.floor(Math.max(metrics.viewportWidthPx, input.viewportWidthPx)),
      );
      const heightPx = WAVEFORM_EMBEDDED_RULER_HEIGHT_PX;
      const { leftPx, widthPx, bufferPx } = computeSegmentBandCanvasWindow({
        scrollLeftPx: metrics.scrollLeftPx,
        viewportWidthPx: viewportWidth,
        timelineWidthPx: input.timelineWidthPx,
      });
      const painted = lastPaintWindowRef.current;

      if (
        !forceRepaintRef.current &&
        !segmentBandCanvasNeedsRepaint({
          scrollLeftPx: metrics.scrollLeftPx,
          viewportWidthPx: viewportWidth,
          paintedLeftPx: painted.leftPx,
          paintedWidthPx: painted.widthPx,
          paintedHeightPx: painted.heightPx,
          layoutHeightPx: heightPx,
          bufferPx: painted.bufferPx || bufferPx,
        })
      ) {
        waveformScrollProfileRulerSkipped(false);
        return;
      }
      forceRepaintRef.current = false;

      const dpr = window.devicePixelRatio || 1;
      const devW = Math.max(1, Math.floor(widthPx * dpr));
      const devH = Math.max(1, Math.floor(heightPx * dpr));
      const dims = lastCanvasDimsRef.current;
      if (dims.devW !== devW || dims.devH !== devH || dims.dpr !== dpr) {
        canvas.width = devW;
        canvas.height = devH;
        dims.devW = devW;
        dims.devH = devH;
        dims.dpr = dpr;
      }

      const beforeShellLeft = lastShellLeftRef.current;
      if (dims.cssW !== widthPx || dims.cssH !== heightPx) {
        lastShellLeftRef.current = null;
        setCspLayoutRules(shell, { left: leftPx, bottom: 0, width: widthPx, height: heightPx });
        setCspLayoutRules(canvas, { width: widthPx, height: heightPx });
        dims.cssW = widthPx;
        dims.cssH = heightPx;
      } else {
        cspLayoutLeftPxIfChanged(shell, leftPx, lastShellLeftRef, setCspLayoutRules);
      }
      waveformScrollProfileRulerRepaint(lastShellLeftRef.current !== beforeShellLeft);

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (!rulerPaintable(input)) {
        ctx.clearRect(0, 0, widthPx, heightPx);
        return;
      }

      const paintTimeSec = input.getPlayheadTimeSec?.() ?? input.currentTimeSec;
      drawWaveformTimeRuler({
        ctx,
        scrollLeftPx: leftPx,
        viewportWidthPx: widthPx,
        timelineWidthPx: input.timelineWidthPx,
        durationSec: input.durationSec,
        currentTimeSec: paintTimeSec,
        formatMediaTime: input.formatMediaTime,
        interactionActive: input.interactionActive,
        palette: paletteRef.current,
      });

      lastPaintWindowRef.current = { leftPx, widthPx, heightPx, bufferPx };
    };

    paintRef.current = paint;

    paletteRef.current = readWaveformRulerCanvasPalette();
    invalidatePaintWindow();
    forceRepaintRef.current = true;
    paint();
    const unsubFrame = subscribeTierScrollFrame(paint);
    const onResize = () => {
      invalidatePaintWindow();
      forceRepaintRef.current = true;
      scheduleTierScrollFrame();
    };
    window.addEventListener("resize", onResize);
    const unsubAppearance = subscribeAppAppearance(() => {
      paletteRef.current = readWaveformRulerCanvasPalette();
      invalidatePaintWindow();
      forceRepaintRef.current = true;
      paintRef.current?.();
    });
    const unsubPlayhead = subscribePlayheadFrame?.(() => {
      forceRepaintRef.current = true;
      paintRef.current?.();
    });

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => {
        invalidatePaintWindow();
        forceRepaintRef.current = true;
        scheduleTierScrollFrame();
      });
      if (shell) ro.observe(shell);
      const tier = tierScrollRef.current;
      if (tier) ro.observe(tier);
    }

    return () => {
      unsubAppearance();
      unsubFrame();
      unsubPlayhead?.();
      ro?.disconnect();
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
    forceRepaintRef.current = true;
    invalidatePaintWindow();
    paintRef.current?.();
  }, [durationSec, timelineWidthPx, viewportWidthPx, currentTimeSec, formatMediaTime, interactionActive, isReady]);

  return (
    <CspLayout
      ref={shellRef}
      className={[
        "waveform-embedded-time-ruler pointer-events-none absolute bottom-0 z-10 h-[22px] overflow-hidden bg-transparent",
        paintable ? "" : "invisible",
      ].join(" ")}
      layout={{ height: WAVEFORM_EMBEDDED_RULER_HEIGHT_PX }}
    >
      <div
        className={`relative z-[1] h-[22px] w-full bg-transparent ${disabled || !paintable ? "pointer-events-none opacity-50" : "pointer-events-auto"} cursor-grab select-none active:cursor-grabbing`}
        onPointerDown={onRulerPointerDown}
      >
        <canvas
          ref={canvasRef}
          className="waveform-time-ruler-canvas pointer-events-none absolute left-0 top-0 z-[1]"
          aria-hidden={!paintable}
        />
      </div>
    </CspLayout>
  );
});
