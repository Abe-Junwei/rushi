import { useLayoutEffect, useRef } from "react";
import { COLORS } from "../config/tokens";
import type { PeakCache } from "../services/waveform/PeakCache";
import {
  drawWaveformPeaksTile,
  prepareCanvasDprDraw,
} from "../services/waveform/waveformPeaksCanvasDraw";

type WaveformOverviewPeaksCanvasProps = {
  peakCache: PeakCache;
  overviewPxPerSec: number;
  overviewWidthPx: number;
  /** Draw/resample axis — may be peak duration while peaks reload. */
  drawMediaDurationSec: number;
  heightPx: number;
};

/** Overview strip: single viewport-wide tile at scroll 0 (ADR-0004 draw path).
 *  Resamples to exactly `overviewWidthPx` columns, bypassing the 320 px floor.
 */
export function WaveformOverviewPeaksCanvas({
  peakCache,
  overviewPxPerSec,
  overviewWidthPx,
  drawMediaDurationSec,
  heightPx,
}: WaveformOverviewPeaksCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || heightPx <= 0 || overviewWidthPx <= 0) return;

    const cssW = Math.max(1, Math.round(overviewWidthPx));
    const cssH = Math.max(1, Math.round(heightPx));
    const ctx = prepareCanvasDprDraw(canvas, cssW, cssH);
    if (!ctx) return;

    const mediaDur =
      drawMediaDurationSec > 0 ? drawMediaDurationSec : peakCache.durationSec;

    try {
      const interleaved = peakCache.getInterleavedPeaksForOverview(
        overviewWidthPx,
        overviewPxPerSec,
        mediaDur,
      );
      if (interleaved.length < 2) return;

      const drew = drawWaveformPeaksTile(ctx, interleaved, {
        tileLeftPx: 0,
        tileWidthPx: cssW,
        timelineWidthPx: cssW,
        heightPx: cssH,
        pxPerSec: overviewPxPerSec,
        peakDurationSec: peakCache.durationSec,
        mediaDurationSec: mediaDur,
        waveColor: COLORS.waveformWave,
        barWidth: 2,
        barGap: 1,
      });

      if (drew) {
        canvas.style.opacity = "1";
      }
    } catch (err) {
      console.error("[WaveformOverviewPeaksCanvas] draw failed:", err);
    }
  }, [peakCache, overviewPxPerSec, overviewWidthPx, drawMediaDurationSec, heightPx]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none relative z-[1] block h-full w-full"
      style={{ width: overviewWidthPx, height: heightPx, opacity: 0 }}
      aria-hidden
    />
  );
}
