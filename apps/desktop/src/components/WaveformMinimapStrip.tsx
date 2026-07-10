import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { PeakCache } from "../services/waveform/PeakCache";
import { subscribeAppAppearance } from "../services/ui/appAppearance";
import {
  drawWaveformMinimap,
} from "../services/waveform/drawWaveformMinimap";
import { resolveMinimapPeaksForDraw } from "../services/waveform/minimapPeaksSource";
import {
  computeOverviewViewportRect,
  overviewClientXToTimeSec,
} from "../utils/waveformOverviewGeometry";
import { setDirectLayoutStyle } from "../utils/cspElementLayout";
import { subscribeTierScrollFrame } from "../utils/tierScrollFrameCoordinator";
import {
  blitScaledMinimapRaster,
  canScaleMinimapRasterCache,
  createMinimapRasterCacheEntry,
  type MinimapRasterCacheEntry,
} from "../services/waveform/waveformMinimapRasterCache";
import { waveformScrollProfileMinimapViewportWrite } from "../services/waveform/waveformScrollProfile";
import { CspLayout } from "./CspLayout";
import { scrollPxCenterTimeInViewport } from "../utils/waveformProjection";
import {
  resolveTierViewportMetrics,
  type TierScrollLayoutMetrics,
  type TierScrollLiveRefs,
} from "../utils/waveformViewport";

type WaveformMinimapStripProps = {
  disabled?: boolean;
  durationSec: number;
  timelineWidthPx: number;
  tierScrollRef: RefObject<HTMLElement | null>;
  tierScrollLive: TierScrollLiveRefs;
  tierScrollLayout: TierScrollLayoutMetrics;
  pxPerSec: number;
  peakCache: PeakCache | null;
  /** Bumps when peak LOD files finish loading — triggers minimap repaint. */
  peakCacheGeneration?: number;
  peaksLoading?: boolean;
  isReady: boolean;
  isPlaying?: boolean;
  exportMinimapPeaks?: (overviewWidthPx: number) => Float32Array | null;
  currentTimeSec: number;
  getDisplayPlayheadTimeSec?: () => number;
  subscribePlayheadFrame?: (cb: (timeSec: number) => void) => () => void;
  onSeek: (timeSec: number) => void;
  onSetScrollLeftPx: (scrollLeftPx: number) => void;
  /** Pause playback-follow so a scrub during playback isn't yanked back by auto-scroll. */
  suppressPlaybackFollowForSelectionSeek?: () => void;
};

export function WaveformMinimapStrip({
  disabled,
  durationSec,
  timelineWidthPx,
  tierScrollRef,
  tierScrollLive,
  tierScrollLayout,
  pxPerSec: _pxPerSec,
  peakCache,
  peakCacheGeneration = 0,
  peaksLoading = false,
  isReady,
  isPlaying = false,
  exportMinimapPeaks,
  currentTimeSec,
  getDisplayPlayheadTimeSec,
  subscribePlayheadFrame,
  onSeek,
  onSetScrollLeftPx,
  suppressPlaybackFollowForSelectionSeek,
}: WaveformMinimapStripProps) {
  void _pxPerSec;
  const wellRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewportRef = useRef<HTMLElement | null>(null);
  const lastMinimapViewportRectRef = useRef<{ left: number; width: number } | null>(null);
  const [overviewWidthPx, setOverviewWidthPx] = useState(0);
  const [minimapPeaksReady, setMinimapPeaksReady] = useState(false);
  const exportMinimapPeaksRef = useRef(exportMinimapPeaks);
  exportMinimapPeaksRef.current = exportMinimapPeaks;
  const rasterCacheRef = useRef<MinimapRasterCacheEntry | null>(null);
  const playheadRef = useRef<HTMLElement | null>(null);
  const getDisplayPlayheadTimeSecRef = useRef(getDisplayPlayheadTimeSec);
  getDisplayPlayheadTimeSecRef.current = getDisplayPlayheadTimeSec;

  const writePlayheadLeft = useCallback(
    (timeSec: number) => {
      const el = playheadRef.current;
      if (!el || durationSec <= 0 || overviewWidthPx <= 0) return;
      const leftPx =
        (Math.max(0, Math.min(durationSec, timeSec)) / durationSec) * overviewWidthPx;
      setDirectLayoutStyle(el, { left: leftPx });
    },
    [durationSec, overviewWidthPx],
  );

  useEffect(() => {
    if (!isReady || !getDisplayPlayheadTimeSec || !subscribePlayheadFrame) return;
    writePlayheadLeft(getDisplayPlayheadTimeSec());
    const unsub = subscribePlayheadFrame((timeSec) => writePlayheadLeft(timeSec));
    return () => {
      unsub();
      const el = playheadRef.current;
      if (el) setDirectLayoutStyle(el, { left: undefined });
    };
  }, [getDisplayPlayheadTimeSec, isReady, subscribePlayheadFrame, writePlayheadLeft]);

  useEffect(() => {
    if (isPlaying || !isReady) return;
    const t = getDisplayPlayheadTimeSecRef.current?.() ?? currentTimeSec;
    writePlayheadLeft(t);
  }, [currentTimeSec, isPlaying, isReady, writePlayheadLeft]);

  const playheadLeftPx =
    durationSec > 0 && overviewWidthPx > 0
      ? (Math.max(0, Math.min(durationSec, currentTimeSec)) / durationSec) * overviewWidthPx
      : 0;

  const MINIMAP_RESIZE_DEBOUNCE_MS = 100;

  useLayoutEffect(() => {
    const well = wellRef.current;
    const canvas = canvasRef.current;
    if (!well || !canvas) return;

    let roRafId = 0;
    let resizeDebounceId = 0;
    let paintSeq = 0;

    const paintNow = () => {
      const seq = ++paintSeq;
      roRafId = 0;
      const widthPx = Math.max(1, Math.floor(well.clientWidth));
      const heightPx = Math.max(1, Math.floor(well.clientHeight));
      setOverviewWidthPx(widthPx);
      const dpr = window.devicePixelRatio || 1;
      const devW = Math.max(1, Math.floor(widthPx * dpr));
      const devH = Math.max(1, Math.floor(heightPx * dpr));
      if (canvas.width !== devW || canvas.height !== devH) {
        canvas.width = devW;
        canvas.height = devH;
      }
      setDirectLayoutStyle(canvas, { width: widthPx, height: heightPx });
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (durationSec <= 0) {
        setMinimapPeaksReady(false);
        rasterCacheRef.current = null;
        ctx.clearRect(0, 0, widthPx, heightPx);
        return;
      }

      void resolveMinimapPeaksForDraw({
        peakCache,
        overviewWidthPx: widthPx,
        layoutDurationSec: durationSec,
        peakCacheGeneration,
        exportFromWaveSurfer: () => exportMinimapPeaksRef.current?.(widthPx) ?? null,
      })
        .then((peaks) => {
          if (seq !== paintSeq) return;
          if (!peaks || peaks.length < 2) {
            setMinimapPeaksReady(false);
            rasterCacheRef.current = null;
            ctx.clearRect(0, 0, widthPx, heightPx);
            return;
          }
          try {
            const cache = rasterCacheRef.current;
            if (canScaleMinimapRasterCache(cache, peaks, heightPx) && cache.widthPx !== widthPx) {
              blitScaledMinimapRaster(ctx, cache, widthPx, heightPx);
              setMinimapPeaksReady(true);
              return;
            }
            if (
              canScaleMinimapRasterCache(cache, peaks, heightPx) &&
              cache.widthPx === widthPx
            ) {
              ctx.clearRect(0, 0, widthPx, heightPx);
              ctx.drawImage(cache.canvas, 0, 0, widthPx, heightPx);
              setMinimapPeaksReady(true);
              return;
            }
            drawWaveformMinimap(ctx, peaks, widthPx, heightPx);
            rasterCacheRef.current = createMinimapRasterCacheEntry(peaks, widthPx, heightPx, canvas);
            setMinimapPeaksReady(true);
          } catch {
            setMinimapPeaksReady(false);
            rasterCacheRef.current = null;
            ctx.clearRect(0, 0, widthPx, heightPx);
          }
        })
        .catch(() => {
          if (seq !== paintSeq) return;
          setMinimapPeaksReady(false);
          rasterCacheRef.current = null;
          ctx.clearRect(0, 0, widthPx, heightPx);
        });
    };

    const schedulePaint = () => {
      if (resizeDebounceId) window.clearTimeout(resizeDebounceId);
      resizeDebounceId = window.setTimeout(() => {
        resizeDebounceId = 0;
        paintNow();
      }, MINIMAP_RESIZE_DEBOUNCE_MS);
    };

    rasterCacheRef.current = null;
    paintNow();
    const ro = new ResizeObserver(() => {
      if (roRafId) return;
      roRafId = requestAnimationFrame(() => {
        roRafId = 0;
        schedulePaint();
      });
    });
    ro.observe(well);
    window.addEventListener("resize", schedulePaint);
    const unsubAppearance = subscribeAppAppearance(schedulePaint);
    return () => {
      unsubAppearance();
      paintSeq += 1;
      rasterCacheRef.current = null;
      ro.disconnect();
      window.removeEventListener("resize", schedulePaint);
      if (roRafId) cancelAnimationFrame(roRafId);
      if (resizeDebounceId) window.clearTimeout(resizeDebounceId);
    };
  }, [durationSec, peakCache, peakCacheGeneration, isReady]);

  const { scrollLeftPx, viewportWidthPx } = useMemo(
    () =>
      resolveTierViewportMetrics({
        tierScrollEl: tierScrollRef.current,
        tierScrollLive,
        tierScrollLayout,
      }),
    [tierScrollLayout, tierScrollLive, tierScrollRef],
  );

  const viewport =
    overviewWidthPx > 0 && timelineWidthPx > 0
      ? computeOverviewViewportRect({
          scrollLeftPx,
          viewportWidthPx,
          timelineWidthPx,
          overviewWidthPx,
        })
      : { leftPx: 0, widthPx: 0 };

  // Track tier scroll per-frame imperatively (subscribeTierScrollFrame), so the viewport
  // rect follows live scroll instead of lagging behind the burst-committed tierScrollLayout.
  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el || overviewWidthPx <= 0 || timelineWidthPx <= 0) return;
    const lastRectRef = lastMinimapViewportRectRef;
    const apply = () => {
      const metrics = resolveTierViewportMetrics({
        tierScrollEl: tierScrollRef.current,
        tierScrollLive,
        tierScrollLayout,
      });
      const rect = computeOverviewViewportRect({
        scrollLeftPx: metrics.scrollLeftPx,
        viewportWidthPx: metrics.viewportWidthPx,
        timelineWidthPx,
        overviewWidthPx,
      });
      const roundedLeft = Math.round(rect.leftPx * 1000) / 1000;
      const roundedWidth = Math.round(rect.widthPx * 1000) / 1000;
      const prev = lastRectRef.current;
      if (prev && prev.left === roundedLeft && prev.width === roundedWidth) return;
      lastRectRef.current = { left: roundedLeft, width: roundedWidth };
      setDirectLayoutStyle(el, { left: rect.leftPx, width: rect.widthPx });
      waveformScrollProfileMinimapViewportWrite();
    };
    apply();
    const unsub = subscribeTierScrollFrame(apply);
    return () => {
      unsub();
      lastMinimapViewportRectRef.current = null;
      setDirectLayoutStyle(el, { left: undefined, width: undefined });
    };
  }, [overviewWidthPx, timelineWidthPx, tierScrollRef, tierScrollLive, tierScrollLayout]);

  const showPeaksPending = peaksLoading && !minimapPeaksReady && durationSec > 0 && isReady;
  const off = disabled || !isReady;

  return (
    <div className="waveform-minimap-strip">
      <div
        ref={wellRef}
        className={`waveform-minimap-well${off ? " is-disabled" : ""}${off ? " pointer-events-none" : ""}`}
        onPointerDown={(e) => {
          if (off || durationSec <= 0) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const timeSec = overviewClientXToTimeSec(e.clientX, rect, durationSec);
          suppressPlaybackFollowForSelectionSeek?.();
          onSeek(timeSec);
          onSetScrollLeftPx(
            scrollPxCenterTimeInViewport({
              timeSec,
              timelineWidthPx,
              durationSec,
              viewportWidthPx,
            }),
          );
        }}
        role="img"
        aria-label="波形总览"
      >
        <canvas ref={canvasRef} className="waveform-minimap-canvas" aria-hidden />
        {showPeaksPending ? (
          <div className="waveform-minimap-pending">
            <span className="text-label text-notion-text-muted">总览生成中…</span>
          </div>
        ) : null}
        {viewport.widthPx > 0 ? (
          <CspLayout
            ref={viewportRef}
            className="waveform-minimap-viewport"
            layout={{ left: viewport.leftPx, width: viewport.widthPx }}
          />
        ) : null}
        {durationSec > 0 ? (
          <CspLayout
            ref={playheadRef}
            className="waveform-minimap-playhead"
            layout={{ left: playheadLeftPx }}
          />
        ) : null}
      </div>
    </div>
  );
}
