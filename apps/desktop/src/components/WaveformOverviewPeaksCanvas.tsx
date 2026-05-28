import { useLayoutEffect, useRef } from "react";
import { COLORS } from "../config/tokens";
import type { PeakCache } from "../services/waveform/PeakCache";
import { drawWaveformPeaksTile } from "../services/waveform/waveformPeaksCanvasDraw";

type WaveformOverviewPeaksCanvasProps = {
  peakCache: PeakCache;
  pxPerSec: number;
  timelineWidthPx: number;
  viewportWidthPx: number;
  heightPx: number;
};

/** Overview strip: single viewport-wide tile at scroll 0 (ADR-0004 draw path). */
export function WaveformOverviewPeaksCanvas({
  peakCache,
  pxPerSec,
  timelineWidthPx,
  viewportWidthPx,
  heightPx,
}: WaveformOverviewPeaksCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || heightPx <= 0 || viewportWidthPx <= 0 || timelineWidthPx <= 0) return;

    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const cssW = Math.max(1, Math.round(viewportWidthPx));
    const cssH = Math.max(1, Math.round(heightPx));
    const targetW = Math.round(cssW * dpr);
    const targetH = Math.round(cssH * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    try {
      const interleaved = peakCache.getInterleavedPeaks(pxPerSec);
      drawWaveformPeaksTile(ctx, interleaved, {
        tileLeftPx: 0,
        tileWidthPx: cssW,
        timelineWidthPx,
        heightPx: cssH,
        pxPerSec,
        durationSec: peakCache.durationSec,
        waveColor: COLORS.waveformWave,
        barWidth: 2,
        barGap: 1,
      });
    } catch (err) {
      console.error("[WaveformOverviewPeaksCanvas] draw failed:", err);
      ctx.clearRect(0, 0, cssW, cssH);
    }
  }, [peakCache, pxPerSec, timelineWidthPx, viewportWidthPx, heightPx]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none block h-full w-full"
      style={{ width: viewportWidthPx, height: heightPx }}
      aria-hidden
    />
  );
}
