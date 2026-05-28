import { useEffect, useRef, useState, type RefObject } from "react";

export type WaveformViewportMetrics = {
  scrollLeftPx: number;
  clientWidthPx: number;
};

/**
 * 读取 tier 横向滚动指标。`poll` 为 true 时用 rAF 采样，避免 scroll 事件链驱动整页 setState。
 */
export function useWaveformViewportMetrics(
  tierScrollRef: RefObject<HTMLElement | null>,
  poll: boolean,
): WaveformViewportMetrics {
  const scrollLeftRef = useRef(0);
  const [clientWidthPx, setClientWidthPx] = useState(400);

  useEffect(() => {
    const el = tierScrollRef.current;
    if (!el) return;

    let rafId = 0;
    const sample = () => {
      scrollLeftRef.current = el.scrollLeft;
      const vw = el.clientWidth;
      setClientWidthPx((prev) => (prev === vw ? prev : vw));
    };

    const loop = () => {
      sample();
      rafId = window.requestAnimationFrame(loop);
    };

    sample();
    if (poll) {
      rafId = window.requestAnimationFrame(loop);
    }

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [poll, tierScrollRef]);

  return {
    scrollLeftPx: scrollLeftRef.current,
    clientWidthPx,
  };
}
