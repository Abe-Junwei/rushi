import { useLayoutEffect, useRef, useState } from "react";
import { COLORS } from "../config/tokens";
import type { PeakCache } from "../services/waveform/PeakCache";
import {
  drawWaveformMinimap,
  WAVEFORM_MINIMAP_HEIGHT_PX,
} from "../services/waveform/drawWaveformMinimap";
import {
  computeOverviewViewportRect,
  overviewClientXToTimeSec,
} from "../utils/waveformOverviewGeometry";
import { scrollPxAlignTimeToViewportLeft } from "../utils/waveformProjection";

type WaveformMinimapStripProps = {
  disabled?: boolean;
  durationSec: number;
  timelineWidthPx: number;
  scrollLeftPx: number;
  viewportWidthPx: number;
  pxPerSec: number;
  peakCache: PeakCache | null;
  isReady: boolean;
  currentTimeSec: number;
  onSeek: (timeSec: number) => void;
  onSetScrollLeftPx: (scrollLeftPx: number) => void;
};

export function WaveformMinimapStrip({
  disabled,
  durationSec,
  timelineWidthPx,
  scrollLeftPx,
  viewportWidthPx,
  pxPerSec: _pxPerSec,
  peakCache,
  isReady,
  currentTimeSec,
  onSeek,
  onSetScrollLeftPx,
}: WaveformMinimapStripProps) {
  void _pxPerSec;
  const shellRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [overviewWidthPx, setOverviewWidthPx] = useState(0);

  useLayoutEffect(() => {
    const shell = shellRef.current;
    const canvas = canvasRef.current;
    if (!shell || !canvas) return;

    let roRafId = 0;

    const paint = () => {
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
      if (!peakCache || durationSec <= 0) {
        ctx.clearRect(0, 0, widthPx, WAVEFORM_MINIMAP_HEIGHT_PX);
        return;
      }
      const bundle = peakCache.getMinimapPeaks(widthPx, durationSec);
      if (!bundle) {
        ctx.clearRect(0, 0, widthPx, WAVEFORM_MINIMAP_HEIGHT_PX);
        return;
      }
      drawWaveformMinimap(ctx, bundle.peaks[0] ?? [], widthPx, WAVEFORM_MINIMAP_HEIGHT_PX);
    };

    paint();
    const ro = new ResizeObserver(() => {
      if (roRafId) return;
      roRafId = requestAnimationFrame(paint);
    });
    ro.observe(shell);
    window.addEventListener("resize", paint);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", paint);
      if (roRafId) cancelAnimationFrame(roRafId);
    };
  }, [durationSec, peakCache]);

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

  return (
    <div
      ref={shellRef}
      className={`relative w-full shrink-0 overflow-hidden border-b border-notion-border/25 bg-notion-sidebar ${
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
      {viewport.widthPx > 0 ? (
        <div
          className="pointer-events-none absolute top-0 h-full rounded-sm border border-zen-saffron/35 bg-zen-saffron/10"
          style={{ left: viewport.leftPx, width: viewport.widthPx }}
        />
      ) : null}
      {durationSec > 0 ? (
        <div
          className="pointer-events-none absolute top-0 h-full w-px bg-notion-text/35"
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
