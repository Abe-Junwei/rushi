import { memo } from "react";
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
 * 固定在 tier 横向滚动视口上的 peaks 层（不随宽时间轴平移）。
 * 必须挂在 tierScrollRef 下、宽内容 div 之前，且 z-index 高于透明 WS 层。
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
  if (!active || !peakCache || heightPx <= 0) return null;

  const vw = Math.max(1, readViewportWidthPx());

  return (
    <div
      className="pointer-events-none absolute left-0 top-0 z-[2] bg-transparent"
      style={{ width: vw, height: heightPx }}
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
