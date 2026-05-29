import { useLayoutEffect, useRef, useState } from "react";
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
  mediaDurationSec: number;
  heightPx: number;
};

/** Overview strip: single viewport-wide tile at scroll 0 (ADR-0004 draw path).
 *  Resamples to exactly `overviewWidthPx` columns, bypassing the 320 px floor.
 */
export function WaveformOverviewPeaksCanvas({
  peakCache,
  overviewPxPerSec,
  overviewWidthPx,
  mediaDurationSec,
  heightPx,
}: WaveformOverviewPeaksCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [drawError, setDrawError] = useState<string | null>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || heightPx <= 0 || overviewWidthPx <= 0) return;

    const cssW = Math.max(1, Math.round(overviewWidthPx));
    const cssH = Math.max(1, Math.round(heightPx));
    const ctx = prepareCanvasDprDraw(canvas, cssW, cssH);
    if (!ctx) return;

    const mediaDur = mediaDurationSec > 0 ? mediaDurationSec : peakCache.durationSec;

    try {
      const interleaved = peakCache.getInterleavedPeaksForOverview(
        overviewWidthPx,
        overviewPxPerSec,
        mediaDur,
      );
      if (interleaved.length < 2) {
        // No data to draw — keep previous frame if any, or leave blank.
        setDrawError("无峰值数据");
        return;
      }

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

      if (!drew) {
        setDrawError("绘制无输出");
      } else {
        setDrawError(null);
      }
    } catch (err) {
      console.error("[WaveformOverviewPeaksCanvas] draw failed:", err);
      setDrawError(err instanceof Error ? err.message : "绘制失败");
      // Intentionally NOT clearing canvas — keep previous frame to avoid blank flash.
    }
  }, [peakCache, overviewPxPerSec, overviewWidthPx, mediaDurationSec, heightPx]);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="pointer-events-none block h-full w-full"
        style={{ width: overviewWidthPx, height: heightPx }}
        aria-hidden
      />
      {drawError ? (
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
          aria-label={`波形绘制错误: ${drawError}`}
        >
          <span className="rounded bg-zen-cinnabar/10 px-2 py-0.5 text-[10px] text-zen-cinnabar">
            {drawError}
          </span>
        </div>
      ) : null}
    </>
  );
}
