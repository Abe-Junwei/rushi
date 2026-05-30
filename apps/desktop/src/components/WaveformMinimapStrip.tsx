import { useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { COLORS } from "../config/tokens";
import type { PeakCache } from "../services/waveform/PeakCache";
import {
  drawWaveformMinimap,
  WAVEFORM_MINIMAP_HEIGHT_PX,
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
  const shellRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [overviewWidthPx, setOverviewWidthPx] = useState(0);
  const [minimapPeaksReady, setMinimapPeaksReady] = useState(false);
  const exportMinimapPeaksRef = useRef(exportMinimapPeaks);
  exportMinimapPeaksRef.current = exportMinimapPeaks;

  useLayoutEffect(() => {
    const shell = shellRef.current;
    const canvas = canvasRef.current;
    if (!shell || !canvas) return;

    let roRafId = 0;
    let paintSeq = 0;

    const paint = () => {
      const seq = ++paintSeq;
      roRafId = 0;
      const widthPx = Math.max(1, Math.floor(shell.clientWidth));
      setOverviewWidthPx(widthPx);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(widthPx * dpr));
      canvas.height = Math.max(1, Math.floor(WAVEFORM_MINIMAP_HEIGHT_PX * dpr));
      canvas.style.width = `${widthPx}px`;
      canvas.style.height = `${WAVEFORM_MINIMAP_HEIGHT_PX}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (durationSec <= 0) {
        setMinimapPeaksReady(false);
        ctx.clearRect(0, 0, widthPx, WAVEFORM_MINIMAP_HEIGHT_PX);
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
            ctx.clearRect(0, 0, widthPx, WAVEFORM_MINIMAP_HEIGHT_PX);
            return;
          }
          try {
            drawWaveformMinimap(ctx, peaks, widthPx, WAVEFORM_MINIMAP_HEIGHT_PX);
            setMinimapPeaksReady(true);
          } catch {
            setMinimapPeaksReady(false);
            ctx.clearRect(0, 0, widthPx, WAVEFORM_MINIMAP_HEIGHT_PX);
          }
        })
        .catch(() => {
          if (seq !== paintSeq) return;
          setMinimapPeaksReady(false);
          ctx.clearRect(0, 0, widthPx, WAVEFORM_MINIMAP_HEIGHT_PX);
        });
    };

    paint();
    const ro = new ResizeObserver(() => {
      if (roRafId) return;
      roRafId = requestAnimationFrame(paint);
    });
    ro.observe(shell);
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

  return (
    <div
      ref={shellRef}
      className={`relative w-full shrink-0 overflow-hidden border-t border-notion-border/25 bg-notion-sidebar ${
        disabled || !isReady ? "pointer-events-none opacity-50" : ""
      }`}
      style={{ height: WAVEFORM_MINIMAP_HEIGHT_PX }}
      onPointerDown={(e) => {
        if (disabled || !isReady || durationSec <= 0) return;
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
      <canvas ref={canvasRef} className="block h-full w-full" />
      {showPeaksPending ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-notion-sidebar/60">
          <span className="text-[10px] text-notion-text-muted">总览生成中…</span>
        </div>
      ) : null}
      {viewport.widthPx > 0 ? (
        <div
          className="pointer-events-none absolute top-0 h-full rounded-sm border border-zen-saffron/35 bg-zen-saffron/10"
          style={{ left: viewport.leftPx, width: viewport.widthPx }}
        />
      ) : null}
      {durationSec > 0 ? (
        <div
          className="pointer-events-none absolute top-0 h-full w-0.5 bg-zen-saffron-mid/75"
          style={{ left: playheadLeftPx }}
        />
      ) : null}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ boxShadow: `inset 0 0 0 1px ${COLORS.notionBorder}33` }}
      />
    </div>
  );
}

export { WAVEFORM_MINIMAP_HEIGHT_PX };
