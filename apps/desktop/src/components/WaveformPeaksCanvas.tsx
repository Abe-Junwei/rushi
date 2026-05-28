import { useEffect, useLayoutEffect, useRef } from "react";
import type { RefObject } from "react";
import { COLORS } from "../config/tokens";
import type { PeakCache } from "../services/waveform/PeakCache";
import { drawWaveformPeaksViewport } from "../services/waveform/waveformPeaksCanvasDraw";
import { computeTimelineWidthPx } from "../utils/pxPerSec";

interface WaveformPeaksCanvasProps {
  peakCache: PeakCache | null;
  pxPerSec: number;
  /** Timeline width for peak distribution; defaults to `computeTimelineWidthPx`. */
  timelineWidthPx?: number;
  /** React 状态（可能滞后）；绘制时优先 `readScrollLeftPx`。 */
  scrollLeftPx: number;
  viewportWidthPx: number;
  heightPx: number;
  progressTimeSec: number;
  active: boolean;
  /** 绘制瞬间读取 tier 真实 scrollLeft，避免滚动与 setState 不同步导致空白。 */
  readScrollLeftPx?: () => number;
  readViewportWidthPx?: () => number;
  /** tier 滚动容器；监听 scroll 以在 React 状态滞后时仍重绘。 */
  scrollContainerRef?: RefObject<HTMLElement | null>;
  repaintKey?: number;
  className?: string;
  style?: React.CSSProperties;
}

/** P3：peaks 可用时用 Canvas 绘制可见窗口；应固定在 tier 视口上（left:0），勿放在可滚动宽内容内再 offset。 */
export function WaveformPeaksCanvas({
  peakCache,
  pxPerSec,
  timelineWidthPx,
  scrollLeftPx,
  viewportWidthPx,
  heightPx,
  progressTimeSec,
  active,
  readScrollLeftPx,
  readViewportWidthPx,
  scrollContainerRef,
  repaintKey = 0,
  className = "pointer-events-none block h-full w-full",
  style,
}: WaveformPeaksCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const paintRafRef = useRef(0);
  const paintRef = useRef<() => void>(() => {});

  useLayoutEffect(() => {
    if (!active || !peakCache || heightPx <= 0) return;

    const paint = () => {
      paintRafRef.current = 0;
      const canvas = canvasRef.current;
      if (!canvas || !peakCache) return;

      const sl = Math.max(0, readScrollLeftPx?.() ?? scrollLeftPx);
      const vw = Math.max(1, readViewportWidthPx?.() ?? viewportWidthPx);
      if (vw <= 0) return;

      const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
      const w = Math.max(1, Math.round(vw));
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
        const distributionWidthPx =
          timelineWidthPx ??
          computeTimelineWidthPx(peakCache.durationSec, pxPerSec);
        drawWaveformPeaksViewport(ctx, interleaved, {
          heightPx: h,
          scrollLeftPx: sl,
          viewportWidthPx: w,
          progressTimeSec,
          pxPerSec,
          durationSec: peakCache.durationSec,
          timelineWidthPx: distributionWidthPx,
          waveColor: COLORS.waveformWave,
          progressColor: COLORS.waveformProgress,
          barWidth: 2,
          barGap: 1,
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("WaveformPeaksCanvas draw failed:", err);
        ctx.clearRect(0, 0, w, h);
      }
    };

    paintRef.current = paint;
    if (paintRafRef.current) cancelAnimationFrame(paintRafRef.current);
    paintRafRef.current = requestAnimationFrame(paint);

    return () => {
      if (paintRafRef.current) cancelAnimationFrame(paintRafRef.current);
    };
  }, [
    active,
    heightPx,
    peakCache,
    progressTimeSec,
    pxPerSec,
    timelineWidthPx,
    repaintKey,
    scrollLeftPx,
    viewportWidthPx,
    readScrollLeftPx,
    readViewportWidthPx,
  ]);

  useLayoutEffect(() => {
    if (!active || !peakCache) return;
    if (paintRafRef.current) cancelAnimationFrame(paintRafRef.current);
    paintRafRef.current = requestAnimationFrame(() => paintRef.current());
  }, [active, peakCache, pxPerSec, timelineWidthPx, repaintKey]);

  useEffect(() => {
    const el = scrollContainerRef?.current;
    if (!el || !active) return;
    const schedulePaint = () => {
      if (paintRafRef.current) return;
      paintRafRef.current = requestAnimationFrame(() => paintRef.current());
    };
    el.addEventListener("scroll", schedulePaint, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(schedulePaint) : null;
    ro?.observe(el);
    schedulePaint();

    // DPR 变化时强制重绘（跨显示器拖拽场景）
    const dprMq = typeof window !== "undefined" ? window.matchMedia("(resolution: 1dppx)") : null;
    const onDprChange = () => schedulePaint();
    dprMq?.addEventListener?.("change", onDprChange);

    return () => {
      el.removeEventListener("scroll", schedulePaint);
      ro?.disconnect();
      dprMq?.removeEventListener?.("change", onDprChange);
    };
  }, [active, peakCache, scrollContainerRef]);

  if (!active || !peakCache) return null;

  const vw = Math.max(1, readViewportWidthPx?.() ?? viewportWidthPx);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: vw, height: heightPx, ...style }}
      aria-hidden
    />
  );
}
