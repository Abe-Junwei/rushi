import { memo, useLayoutEffect, useRef } from "react";
import type { RefObject } from "react";
import type { PeakCache } from "../services/waveform/PeakCache";
import { WaveformPeaksCanvas } from "./WaveformPeaksCanvas";

export type WaveformPeaksViewportLayerProps = {
  peakCache: PeakCache | null;
  active: boolean;
  pxPerSec: number;
  scrollLeftPx: number;
  viewportWidthPx: number;
  heightPx: number;
  progressTimeSec: number;
  tierScrollRef: RefObject<HTMLElement | null>;
  readScrollLeftPx: () => number;
  readViewportWidthPx: () => number;
  /** 递增以在 peaks load / zoom 完成后强制 Canvas 重绘。 */
  repaintKey?: number;
};

/**
 * Peaks 层挂在 `tierScrollRef` 内部、宽内容之前。
 *
 * 2026-05 根因修复：CSS `position:absolute` 在 `overflow-x:auto` 父内会随内容横向
 * 滚出视口（长音频后部 peaks 看不见的真根因）。CSS `position:sticky` 在 inline-block
 * + width:0 的退化形式下也不稳定（部分浏览器/帧首次后 sticky 失效）。
 *
 * 改用 **手动 sticky**：layer 外壳 `position:absolute;left:0;top:0`，订阅 tier 的
 * scroll 事件，用 `transform: translateX(scrollLeft)` 把它"贴"在视口左边。这是
 * 最可控、最跨浏览器一致的方案，避免 sticky 在 inline 上下文里的边缘行为。
 *
 * 外壳 `width:0;height:0`（不占布局），内部 canvas wrapper `absolute` 撑满
 * vw×heightPx。z-index=1，让 wide-content (z=1, source order 在后) 里的 segment
 * overlay (z=3) / ruler (z=10) 自然覆盖在 peaks 之上。
 */
export const WaveformPeaksViewportLayer = memo(function WaveformPeaksViewportLayer({
  peakCache,
  active,
  pxPerSec,
  scrollLeftPx,
  viewportWidthPx: _viewportWidthPx,
  heightPx,
  progressTimeSec,
  tierScrollRef,
  readScrollLeftPx,
  readViewportWidthPx,
  repaintKey = 0,
}: WaveformPeaksViewportLayerProps) {
  const anchorRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const tier = tierScrollRef.current;
    const anchor = anchorRef.current;
    if (!tier || !anchor) return;

    let rafId = 0;
    const apply = () => {
      rafId = 0;
      const el = anchorRef.current;
      const tierEl = tierScrollRef.current;
      if (!el || !tierEl) return;
      el.style.transform = `translateX(${tierEl.scrollLeft}px)`;
    };
    const schedule = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(apply);
    };

    apply();
    tier.addEventListener("scroll", schedule, { passive: true });
    return () => {
      tier.removeEventListener("scroll", schedule);
      if (rafId) cancelAnimationFrame(rafId);
    };
    // active/peakCache 决定 anchor 是否实际挂载，必须作为依赖以便首次挂载后绑定 scroll。
  }, [active, peakCache, tierScrollRef]);

  if (!active || !peakCache || heightPx <= 0) return null;

  const vw = Math.max(1, readViewportWidthPx());

  return (
    <div
      ref={anchorRef}
      className="pointer-events-none absolute left-0 top-0 z-[1]"
      style={{ width: vw, height: heightPx, willChange: "transform" }}
      aria-hidden
    >
      <WaveformPeaksCanvas
        peakCache={peakCache}
        pxPerSec={pxPerSec}
        scrollLeftPx={scrollLeftPx}
        viewportWidthPx={vw}
        heightPx={heightPx}
        progressTimeSec={progressTimeSec}
        active
        readScrollLeftPx={readScrollLeftPx}
        readViewportWidthPx={readViewportWidthPx}
        scrollContainerRef={tierScrollRef}
        repaintKey={repaintKey}
        className="block h-full w-full"
      />
    </div>
  );
});
