import { memo, useLayoutEffect, useRef, type RefObject } from "react";
import type { PeakCache } from "../services/waveform/PeakCache";
import {
  computeViewportPlayedTintWidthPx,
  computeWaveformViewportPeaksWindow,
  drawWaveformViewportPeaks,
  VIEWPORT_PEAKS_PLAYED_TINT_MIN_INTERVAL_MS,
} from "../services/waveform/drawWaveformViewportPeaks";
import { resolveViewportPeaksPxPerSec } from "../services/waveform/extractViewportWindowPeaks";
import { subscribeAppAppearance } from "../services/ui/appAppearance";
import {
  resolveTierViewportMetricsDuringScrollFrame,
  type TierScrollLayoutMetrics,
  type TierScrollLiveRefs,
} from "../utils/waveformViewport";
import { setDirectLayoutStyle } from "../utils/cspElementLayout";
import { subscribeTierScrollFrame } from "../utils/tierScrollFrameCoordinator";
import { readWaveformSurferPalette } from "../utils/waveformThemeColors";
import { segmentBandCanvasNeedsRepaint } from "../utils/waveformSegmentBandCanvasScroll";

type WaveformViewportPeaksCanvasProps = {
  durationSec: number;
  timelineWidthPx: number;
  layoutHeightPx: number;
  drawPxPerSec: number;
  peakCache: PeakCache | null;
  peakCacheGeneration?: number;
  getPlayheadSec?: () => number;
  subscribePlayheadFrame?: (cb: (timeSec: number) => void) => () => void;
  tierScrollRef: RefObject<HTMLElement | null>;
  tierScrollLive: TierScrollLiveRefs;
  tierScrollLayout: TierScrollLayoutMetrics;
};

/**
 * WS-2b visible main waveform: PeakCache peaks in a virtual scroll window.
 * Window peaks are extracted at ~1 CSS px / column (not full-timeline 40960 stretch).
 * Played region is a throttled integer-width wash overlay (not per-frame peaks redraw).
 */
export const WaveformViewportPeaksCanvas = memo(function WaveformViewportPeaksCanvas({
  durationSec,
  timelineWidthPx,
  layoutHeightPx,
  drawPxPerSec,
  peakCache,
  peakCacheGeneration = 0,
  getPlayheadSec,
  subscribePlayheadFrame,
  tierScrollRef,
  tierScrollLive,
  tierScrollLayout,
}: WaveformViewportPeaksCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const tintRef = useRef<HTMLDivElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const lodReadyGenRef = useRef(0);
  const peaksScratchRef = useRef<Float32Array | null>(null);
  const tierMetricsRef = useRef({ tierScrollRef, tierScrollLive, tierScrollLayout });
  tierMetricsRef.current = { tierScrollRef, tierScrollLive, tierScrollLayout };
  const inputRef = useRef({
    durationSec,
    timelineWidthPx,
    layoutHeightPx,
    drawPxPerSec,
    peakCache,
  });
  inputRef.current = {
    durationSec,
    timelineWidthPx,
    layoutHeightPx,
    drawPxPerSec,
    peakCache,
  };
  const paintRef = useRef<((force?: boolean) => void) | null>(null);
  const lastPaintWindowRef = useRef({
    leftPx: -1,
    widthPx: 0,
    heightPx: 0,
    bufferPx: 0,
  });
  const lastCssLeftRef = useRef<number | null>(null);
  const lastTintWidthPxRef = useRef<number | null>(null);
  const lastTintWriteAtMsRef = useRef(0);

  const applyTintChrome = () => {
    const tint = tintRef.current;
    const painted = lastPaintWindowRef.current;
    if (!tint || painted.heightPx <= 0) return;
    setDirectLayoutStyle(tint, { height: painted.heightPx });
  };

  const updatePlayedTint = (timeSec: number | undefined, opts?: { force?: boolean }) => {
    const tint = tintRef.current;
    const painted = lastPaintWindowRef.current;
    const input = inputRef.current;
    if (!tint || painted.leftPx < 0 || input.durationSec <= 0 || input.timelineWidthPx <= 0) {
      return;
    }
    const force = Boolean(opts?.force);
    const now = performance.now();
    if (
      !force &&
      now - lastTintWriteAtMsRef.current < VIEWPORT_PEAKS_PLAYED_TINT_MIN_INTERVAL_MS
    ) {
      return;
    }
    const t = timeSec ?? getPlayheadSec?.() ?? 0;
    const playedW = computeViewportPlayedTintWidthPx({
      playheadSec: t,
      durationSec: input.durationSec,
      timelineWidthPx: input.timelineWidthPx,
      windowLeftPx: painted.leftPx,
      windowWidthPx: painted.widthPx,
    });
    if (!force && lastTintWidthPxRef.current === playedW) return;
    lastTintWidthPxRef.current = playedW;
    lastTintWriteAtMsRef.current = now;
    setDirectLayoutStyle(tint, { width: playedW });
  };

  useLayoutEffect(() => {
    let cancelled = false;
    lodReadyGenRef.current = 0;
    lastPaintWindowRef.current = { leftPx: -1, widthPx: 0, heightPx: 0, bufferPx: 0 };
    lastTintWidthPxRef.current = null;
    lastTintWriteAtMsRef.current = 0;
    if (!peakCache || durationSec <= 0 || timelineWidthPx <= 0) {
      paintRef.current?.(true);
      return;
    }
    const px = resolveViewportPeaksPxPerSec(timelineWidthPx, durationSec, drawPxPerSec);
    void peakCache.ensureLevelForPxPerSec(px).then(
      () => {
        if (cancelled) return;
        lodReadyGenRef.current += 1;
        paintRef.current?.(true);
      },
      () => {
        if (cancelled) return;
        lodReadyGenRef.current = 0;
        paintRef.current?.(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [drawPxPerSec, durationSec, peakCache, peakCacheGeneration, timelineWidthPx]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const shell = shellRef.current;
    if (!canvas || !shell) return;

    const paint = (force = false) => {
      const input = inputRef.current;
      const tierMetrics = tierMetricsRef.current;
      const { scrollLeftPx, viewportWidthPx } = resolveTierViewportMetricsDuringScrollFrame({
        tierScrollEl: tierMetrics.tierScrollRef.current,
        tierScrollLive: tierMetrics.tierScrollLive,
        tierScrollLayout: tierMetrics.tierScrollLayout,
      });
      const win = computeWaveformViewportPeaksWindow({
        scrollLeftPx,
        viewportWidthPx,
        timelineWidthPx: input.timelineWidthPx,
      });
      const painted = lastPaintWindowRef.current;
      const needsRepaint =
        force ||
        segmentBandCanvasNeedsRepaint({
          scrollLeftPx,
          viewportWidthPx,
          timelineWidthPx: input.timelineWidthPx,
          paintedLeftPx: painted.leftPx,
          paintedWidthPx: painted.widthPx,
          paintedHeightPx: painted.heightPx,
          layoutHeightPx: input.layoutHeightPx,
          bufferPx: painted.bufferPx,
        });
      if (!needsRepaint) {
        updatePlayedTint(undefined, { force: true });
        return;
      }

      const cssW = Math.max(1, Math.floor(win.widthPx));
      const cssH = Math.max(1, Math.floor(input.layoutHeightPx));
      const dpr = window.devicePixelRatio || 1;
      const devW = Math.max(1, Math.floor(cssW * dpr));
      const devH = Math.max(1, Math.floor(cssH * dpr));
      if (canvas.width !== devW || canvas.height !== devH) {
        canvas.width = devW;
        canvas.height = devH;
      }
      const roundedLeft = Math.round(win.leftPx * 1000) / 1000;
      if (lastCssLeftRef.current !== roundedLeft) {
        lastCssLeftRef.current = roundedLeft;
        setDirectLayoutStyle(shell, {
          left: win.leftPx,
          width: cssW,
          height: cssH,
        });
      } else {
        setDirectLayoutStyle(shell, { width: cssW, height: cssH });
      }
      lastPaintWindowRef.current = {
        leftPx: win.leftPx,
        widthPx: cssW,
        heightPx: cssH,
        bufferPx: win.bufferPx,
      };
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const palette = readWaveformSurferPalette();
      applyTintChrome();

      const cache = input.peakCache;
      const need = cssW * 2;
      let scratch = peaksScratchRef.current;
      if (!scratch || scratch.length < need) {
        scratch = new Float32Array(need);
        peaksScratchRef.current = scratch;
      }
      const peaks =
        cache && lodReadyGenRef.current > 0
          ? cache.getViewportWindowPeaks({
              pxPerSec: input.drawPxPerSec,
              durationSec: input.durationSec,
              timelineWidthPx: input.timelineWidthPx,
              windowLeftPx: win.leftPx,
              windowWidthPx: cssW,
              into: scratch,
            })
          : null;

      if (!peaks) {
        ctx.clearRect(0, 0, cssW, cssH);
        updatePlayedTint(undefined, { force: true });
        return;
      }
      // Window-local peaks: 1 CSS px ≈ 1 column (bypass full-timeline stretch).
      drawWaveformViewportPeaks({
        ctx,
        peaks,
        durationSec: input.durationSec,
        timelineWidthPx: cssW,
        windowLeftPx: 0,
        windowWidthPx: cssW,
        heightPx: cssH,
        waveColor: palette.waveColor,
      });
      updatePlayedTint(undefined, { force: true });
    };

    paintRef.current = paint;
    paint(true);
    const unsubScroll = subscribeTierScrollFrame(() => paint(false));
    const unsubTheme = subscribeAppAppearance(() => {
      paint(true);
    });
    const unsubPlayhead =
      subscribePlayheadFrame?.((t) => {
        updatePlayedTint(t);
      }) ?? (() => {});
    return () => {
      if (paintRef.current === paint) paintRef.current = null;
      unsubScroll();
      unsubTheme();
      unsubPlayhead();
    };
  }, [getPlayheadSec, subscribePlayheadFrame]);

  return (
    <div
      ref={shellRef}
      className="pointer-events-none absolute top-0 z-[2] overflow-hidden"
      aria-hidden
      data-ws2b-viewport-peaks-canvas=""
    >
      <canvas ref={canvasRef} className="absolute left-0 top-0 h-full w-full" />
      <div
        ref={tintRef}
        className="waveform-viewport-played-tint"
        data-ws2b-played-tint=""
      />
    </div>
  );
});
