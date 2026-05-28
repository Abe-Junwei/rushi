import { useEffect, useState, type RefObject } from "react";

export type WaveformViewportMetrics = {
  scrollLeftPx: number;
  clientWidthPx: number;
};

/**
 * tier 视口指标；在 EditorWaveformPane 内 rAF 采样，避免 scroll 链路上浮到 ProjectPanel。
 */
export function useWaveformViewportMetrics(
  tierScrollRef: RefObject<HTMLElement | null>,
  poll: boolean,
): WaveformViewportMetrics {
  const [metrics, setMetrics] = useState<WaveformViewportMetrics>({
    scrollLeftPx: 0,
    clientWidthPx: 400,
  });

  useEffect(() => {
    const el = tierScrollRef.current;
    if (!el) return;

    let rafId = 0;
    const sample = () => {
      const next = { scrollLeftPx: el.scrollLeft, clientWidthPx: el.clientWidth };
      setMetrics((prev) =>
        prev.scrollLeftPx === next.scrollLeftPx && prev.clientWidthPx === next.clientWidthPx ? prev : next,
      );
    };

    const loop = () => {
      sample();
      rafId = window.requestAnimationFrame(loop);
    };

    sample();
    if (poll) {
      rafId = window.requestAnimationFrame(loop);
    } else {
      const onScroll = () => sample();
      el.addEventListener("scroll", onScroll, { passive: true });
      const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(sample) : null;
      ro?.observe(el);
      return () => {
        el.removeEventListener("scroll", onScroll);
        ro?.disconnect();
        if (rafId) window.cancelAnimationFrame(rafId);
      };
    }

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [poll, tierScrollRef]);

  return metrics;
}
