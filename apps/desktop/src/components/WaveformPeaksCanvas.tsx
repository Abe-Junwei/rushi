import { useLayoutEffect, useRef } from "react";
import { COLORS } from "../config/tokens";
import type { PeakCache } from "../services/waveform/PeakCache";
import { drawWaveformPeaksViewport } from "../services/waveform/waveformPeaksCanvasDraw";

interface WaveformPeaksCanvasProps {
  peakCache: PeakCache | null;
  pxPerSec: number;
  scrollLeftPx: number;
  viewportWidthPx: number;
  heightPx: number;
  progressTimeSec: number;
  active: boolean;
}

/** P3：peaks 可用时用 Canvas 绘制可见窗口，WaveSurfer 波形层透明仅保留交互/Regions。 */
export function WaveformPeaksCanvas({
  peakCache,
  pxPerSec,
  scrollLeftPx,
  viewportWidthPx,
  heightPx,
  progressTimeSec,
  active,
}: WaveformPeaksCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef(0);

  useLayoutEffect(() => {
    if (!active || !peakCache || viewportWidthPx <= 0 || heightPx <= 0) return;

    const paint = () => {
      rafRef.current = 0;
      const canvas = canvasRef.current;
      if (!canvas || !peakCache) return;

      const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
      const w = Math.max(1, Math.round(viewportWidthPx));
      const h = Math.max(1, Math.round(heightPx));
      const targetW = Math.round(w * dpr);
      const targetH = Math.round(h * dpr);
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      try {
        const interleaved = peakCache.getInterleavedPeaks(pxPerSec);
        drawWaveformPeaksViewport(ctx, interleaved, {
          heightPx: h,
          scrollLeftPx,
          viewportWidthPx: w,
          progressTimeSec,
          pxPerSec,
          waveColor: COLORS.waveformWave,
          progressColor: COLORS.waveformProgress,
          barWidth: 2,
          barGap: 1,
        });
      } catch {
        ctx.clearRect(0, 0, w, h);
      }
    };

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(paint);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [active, heightPx, peakCache, progressTimeSec, pxPerSec, scrollLeftPx, viewportWidthPx]);

  if (!active || !peakCache) return null;

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute left-0 top-0 z-[1]"
      aria-hidden
    />
  );
}
