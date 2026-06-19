import { memo, useLayoutEffect, useRef } from "react";
import type { TierScrollLayoutMetrics, TierScrollLiveRefs } from "../utils/waveformViewport";
import { useWaveformTimeRulerInteraction } from "../hooks/useWaveformTimeRulerInteraction";
import { useWaveformTimeRulerMetrics } from "../hooks/useWaveformTimeRulerMetrics";
import { CspLayout } from "./CspLayout";
import { WaveformTimeRulerTickLayer } from "./WaveformTimeRulerTickLayer";
import { subscribeTierScrollFrame } from "../utils/tierScrollFrameCoordinator";
import { setCspLayoutRules } from "../utils/cspElementLayout";

export type WaveformTimeRulerProps = {
  durationSec: number;
  timelineWidthPx: number;
  /** Committed tier layout — scroll/viewport reads go through resolveTierViewportMetrics. */
  tierScrollLayout: TierScrollLayoutMetrics;
  tierScrollLive?: TierScrollLiveRefs;
  tierScrollRef?: React.RefObject<HTMLElement | null>;
  /** Legacy fallbacks when tierScrollLayout is absent (unused in embedded viewport). */
  scrollLeftPx?: number;
  viewportWidthPx?: number;
  /** Retained for API compat; tick density uses effectiveTimelinePxPerSec. */
  pxPerSec: number;
  currentTimeSec: number;
  formatMediaTime: (sec: number) => string;
  disabled?: boolean;
  /** ink：深色条上（默认）；light：浅色独立条；embedded：嵌入波形底部 */
  appearance?: "ink" | "light" | "embedded";
  /** timeline：随宽内容滚动；viewport：sticky 视口宽标尺（embedded 推荐） */
  coordinateSpace?: "timeline" | "viewport";
  /** embedded + overlay：透明叠在波形底部，无背景条 */
  overlayOnWaveform?: boolean;
  /** 点击时间尺（相对 tier 视口）寻位 */
  onSeekFromTierClientX: (clientX: number) => void;
  onSetScrollLeftPx: (px: number) => void;
  /** 播放期由 rAF 直写 playhead，避免 React 每帧重绘 */
  playheadLineRef?: React.RefObject<SVGLineElement | null>;
  hidePlayheadReact?: boolean;
};

export { WAVEFORM_EMBEDDED_RULER_HEIGHT_PX as WAVEFORM_EMBEDDED_TIME_RULER_H_PX } from "../services/waveform/drawWaveformTimeRuler";
import { WAVEFORM_EMBEDDED_RULER_HEIGHT_PX } from "../services/waveform/drawWaveformTimeRuler";

const RULER_H = WAVEFORM_EMBEDDED_RULER_HEIGHT_PX;

export const WaveformTimeRuler = memo(function WaveformTimeRuler({
  durationSec,
  timelineWidthPx,
  tierScrollLayout,
  scrollLeftPx: _scrollLeftPxProp = 0,
  viewportWidthPx: _viewportWidthPxProp = 0,
  pxPerSec: _pxPerSec,
  currentTimeSec,
  formatMediaTime,
  disabled,
  onSeekFromTierClientX,
  onSetScrollLeftPx,
  appearance = "ink",
  coordinateSpace = "timeline",
  tierScrollLive,
  tierScrollRef,
  playheadLineRef,
  hidePlayheadReact = false,
  overlayOnWaveform = false,
}: WaveformTimeRulerProps) {
  const viewportTickLayerRef = useRef<HTMLDivElement | null>(null);
  const metrics = useWaveformTimeRulerMetrics({
    durationSec,
    timelineWidthPx,
    tierScrollLayout,
    tierScrollLive,
    tierScrollRef,
    appearance,
    coordinateSpace,
    overlayOnWaveform,
    currentTimeSec,
  });

  const { interactionActive, onRulerPointerDown } = useWaveformTimeRulerInteraction({
    embedded: metrics.embedded,
    currentTimeSec,
    liveScrollLeftPx: metrics.liveScrollLeftPx,
    disabled,
    onSeekFromTierClientX,
    onSetScrollLeftPx,
  });

  useLayoutEffect(() => {
    if (!metrics.tickLayerViewportSpace) return;
    const layer = viewportTickLayerRef.current;
    const scrollEl = tierScrollRef?.current;
    if (!layer || !scrollEl) return;
    const applyScrollDeltaTransform = () => {
      const dx = metrics.tickLayerBaseScrollLeftPx - scrollEl.scrollLeft;
      setCspLayoutRules(layer, { transform: `translate3d(${dx}px, 0, 0)` });
    };
    applyScrollDeltaTransform();
    scrollEl.addEventListener("scroll", applyScrollDeltaTransform, { passive: true });
    const unsubscribeFrame = subscribeTierScrollFrame(applyScrollDeltaTransform);
    return () => {
      scrollEl.removeEventListener("scroll", applyScrollDeltaTransform);
      unsubscribeFrame();
      setCspLayoutRules(layer, { transform: undefined });
    };
  }, [metrics.tickLayerBaseScrollLeftPx, metrics.tickLayerViewportSpace, tierScrollRef]);

  if (durationSec <= 0 || timelineWidthPx <= 0) {
    return null;
  }

  const tickLayer = (
    <WaveformTimeRulerTickLayer
      ticks={metrics.ticks}
      majorTicks={metrics.majorTicks}
      embeddedLabelStride={metrics.embeddedLabelStride}
      viewportSpace={metrics.tickLayerViewportSpace}
      renderWidthPx={metrics.renderWidthPx}
      durationSec={durationSec}
      embedded={metrics.embedded}
      ink={metrics.ink}
      interactionActive={interactionActive}
      highlightedMajorTickTime={metrics.highlightedMajorTickTime}
      timelineToDisplayPx={metrics.timelineToDisplayPx}
      formatMediaTime={formatMediaTime}
      playheadLineRef={playheadLineRef}
      hidePlayheadReact={hidePlayheadReact}
      playheadLeft={metrics.playheadLeft}
      showPlayheadLine={!metrics.embeddedOverlay}
      rulerHeightPx={RULER_H}
      embeddedOverlay={metrics.embeddedOverlay}
    />
  );

  return (
    <CspLayout
      className={
        metrics.embeddedOverlay
          ? "waveform-embedded-time-ruler pointer-events-none absolute inset-x-0 bottom-0 z-10 overflow-hidden bg-transparent"
          : metrics.embedded
            ? "relative shrink-0 bg-transparent"
            : metrics.ink
              ? "relative shrink-0 border-t border-notion-divider bg-notion-sidebar-active"
              : "relative shrink-0 border-t border-notion-divider bg-notion-sidebar"
      }
      layout={{
        width: metrics.embeddedOverlay ? "100%" : metrics.renderWidthPx,
        height: RULER_H,
      }}
    >
      <div
        className={`relative z-[1] h-[22px] bg-transparent ${metrics.embeddedOverlay ? "pointer-events-auto" : ""} cursor-grab select-none active:cursor-grabbing ${disabled ? "pointer-events-none opacity-50" : ""}`}
        onPointerDown={onRulerPointerDown}
      >
        {metrics.tickLayerViewportSpace ? (
          <div ref={viewportTickLayerRef} className="relative h-full will-change-transform">
            {tickLayer}
          </div>
        ) : (
          tickLayer
        )}
      </div>
    </CspLayout>
  );
});
