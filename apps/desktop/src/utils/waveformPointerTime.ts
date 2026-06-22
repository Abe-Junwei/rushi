import { readTierViewportMetricsDuringScrollFrame } from "./tierScrollFrameCoordinator";
import { timelinePxToTime } from "./waveformProjection";
import {
  resolveTierViewportMetrics,
  type TierScrollLayoutMetrics,
  type TierScrollLiveRefs,
} from "./waveformViewport";

/** 将屏幕 X 映射为时间轴像素偏移（容器已在 tier 滚动坐标系内，勿再加 scrollLeft）。 */
export function clientXToTimelinePx(clientX: number, containerViewportLeftPx: number): number {
  return clientX - containerViewportLeftPx;
}

export type WaveformPointerTimeTierInput = {
  clientX: number;
  tierScrollEl: HTMLElement | null | undefined;
  tierScrollLive?: TierScrollLiveRefs;
  tierScrollLayout?: TierScrollLayoutMetrics;
  timelineWidthPx: number;
  durationSec: number;
};

/** Map screen X → seconds using the same tier metrics path as band / playhead (TRUTH-006). */
export function resolveWaveformPointerTimeSecFromClientX(input: WaveformPointerTimeTierInput): number {
  const { clientX, tierScrollEl, timelineWidthPx, durationSec } = input;
  if (timelineWidthPx <= 0 || durationSec <= 0 || !tierScrollEl) return 0;

  const snapshot = readTierViewportMetricsDuringScrollFrame();
  const metrics =
    snapshot ??
    resolveTierViewportMetrics({
      tierScrollEl,
      tierScrollLive: input.tierScrollLive,
      tierScrollLayout: input.tierScrollLayout ?? {
        scrollLeftPx: tierScrollEl.scrollLeft,
        clientWidthPx: tierScrollEl.clientWidth,
      },
    });

  const rect = tierScrollEl.getBoundingClientRect();
  return clientXToTimeSecInTierScroll({
    clientX,
    tierViewportLeftPx: rect.left,
    tierScrollLeftPx: metrics.scrollLeftPx,
    timelineWidthPx,
    durationSec,
  });
}

/** Map screen X to timeline seconds via tier scroll (overlay gesture authority). */
export function clientXToTimeSecInTierScroll(input: {
  clientX: number;
  tierViewportLeftPx: number;
  tierScrollLeftPx: number;
  timelineWidthPx: number;
  durationSec: number;
  contentOffsetLeftPx?: number;
}): number {
  const { clientX, tierViewportLeftPx, tierScrollLeftPx, timelineWidthPx, durationSec } = input;
  if (timelineWidthPx <= 0 || durationSec <= 0) return 0;
  const relPx =
    clientX - tierViewportLeftPx + tierScrollLeftPx - (input.contentOffsetLeftPx ?? 0);
  return timelinePxToTime(relPx, timelineWidthPx, durationSec);
}
