import { useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { PeakCache } from "../services/waveform/PeakCache";
import {
  drawWaveformMinimap,
} from "../services/waveform/drawWaveformMinimap";
import { resolveMinimapPeaksForDraw } from "../services/waveform/minimapPeaksSource";
import {
  computeOverviewViewportRect,
  overviewClientXToTimeSec,
} from "../utils/waveformOverviewGeometry";
import { scrollPxAlignTimeToViewportLeft } from "../utils/waveformProjection";
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
  exportMinimapPeaks?: (overviewWidthPx: number) => Float32Array | null;
  currentTimeSec: number;
  onSeek: (timeSec: number) => void;
  onSetScrollLeftPx: (scrollLeftPx: number) => void;
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
  exportMinimapPeaks,
  currentTimeSec,
  onSeek,
  onSetScrollLeftPx,
}: WaveformMinimapStripProps) {
  void _pxPerSec;
  const wellRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [overviewWidthPx, setOverviewWidthPx] = useState(0);
  const [minimapPeaksReady, setMinimapPeaksReady] = useState(false);
  const exportMinimapPeaksRef = useRef(exportMinimapPeaks);
  exportMinimapPeaksRef.current = exportMinimapPeaks;

  useLayoutEffect(() => {
    const well = wellRef.current;
    const canvas = canvasRef.current;
    if (!well || !canvas) return;

    let roRafId = 0;
    let paintSeq = 0;

    const paint = () => {
      const seq = ++paintSeq;
      roRafId = 0;
      const widthPx = Math.max(1, Math.floor(well.clientWidth));
      const heightPx = Math.max(1, Math.floor(well.clientHeight));
      setOverviewWidthPx(widthPx);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(widthPx * dpr));
      canvas.height = Math.max(1, Math.floor(heightPx * dpr));
      canvas.style.width = `${widthPx}px`;
      canvas.style.height = `${heightPx}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (durationSec <= 0) {
        setMinimapPeaksReady(false);
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
            ctx.clearRect(0, 0, widthPx, heightPx);
            return;
          }
          try {
            drawWaveformMinimap(ctx, peaks, widthPx, heightPx);
            setMinimapPeaksReady(true);
          } catch {
            setMinimapPeaksReady(false);
            ctx.clearRect(0, 0, widthPx, heightPx);
          }
        })
        .catch(() => {
          if (seq !== paintSeq) return;
          setMinimapPeaksReady(false);
          ctx.clearRect(0, 0, widthPx, heightPx);
        });
    };

    paint();
    const ro = new ResizeObserver(() => {
      if (roRafId) return;
      roRafId = requestAnimationFrame(paint);
    });
    ro.observe(well);
    window.addEventListener("resize", paint);
    return () => {
      paintSeq += 1;
      ro.disconnect();
      window.removeEventListener("resize", paint);
      if (roRafId) cancelAnimationFrame(roRafId);
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

  const playheadLeftPx =
    durationSec > 0 && overviewWidthPx > 0
      ? (Math.max(0, Math.min(durationSec, currentTimeSec)) / durationSec) * overviewWidthPx
      : 0;

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
          onSeek(timeSec);
          onSetScrollLeftPx(
            scrollPxAlignTimeToViewportLeft({
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
          <div
            className="waveform-minimap-viewport"
            style={{ left: viewport.leftPx, width: viewport.widthPx }}
          />
        ) : null}
        {durationSec > 0 ? (
          <div className="waveform-minimap-playhead" style={{ left: playheadLeftPx }} />
        ) : null}
      </div>
    </div>
  );
}
