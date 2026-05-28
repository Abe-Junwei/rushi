import { useEffect, useState, type RefObject } from "react";

export type WaveformViewportMetrics = {
  scrollLeftPx: number;
  clientWidthPx: number;
};

/**
 * tier 视口指标。滚动时用 rAF 合并采样，减少 React 状态滞后导致 peaks 画布空白。
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

    let scrollRaf = 0;
    let loopRaf = 0;

    const sample = () => {
      const currentEl = tierScrollRef.current;
      if (!currentEl) return;
      const next = { scrollLeftPx: currentEl.scrollLeft, clientWidthPx: currentEl.clientWidth };
      setMetrics((prev) =>
        prev.scrollLeftPx === next.scrollLeftPx && prev.clientWidthPx === next.clientWidthPx ? prev : next,
      );
    };

    const scheduleSample = () => {
      if (scrollRaf) return;
      scrollRaf = window.requestAnimationFrame(() => {
        scrollRaf = 0;
        sample();
      });
    };

    const loop = () => {
      sample();
      loopRaf = window.requestAnimationFrame(loop);
    };

    sample();
    el.addEventListener("scroll", scheduleSample, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(scheduleSample) : null;
    ro?.observe(el);

    if (poll) {
      loopRaf = window.requestAnimationFrame(loop);
    }

    return () => {
      el.removeEventListener("scroll", scheduleSample);
      ro?.disconnect();
      if (scrollRaf) window.cancelAnimationFrame(scrollRaf);
      if (loopRaf) window.cancelAnimationFrame(loopRaf);
    };
  }, [poll, tierScrollRef]);

  return metrics;
}
