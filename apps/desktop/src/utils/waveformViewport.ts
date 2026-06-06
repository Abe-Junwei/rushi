import { visibleTimeWindowFromScroll } from "./waveformProjection";
import type { RefObject } from "react";

export type TierScrollLiveRefs = {
  scrollLeftRef: RefObject<number>;
  clientWidthRef: RefObject<number>;
};

export type TierScrollLayoutMetrics = {
  scrollLeftPx: number;
  clientWidthPx: number;
};

export type WaveformRulerView = {
  start: number;
  end: number;
};

/** Tier scrollport width — set imperatively on the tier element for sticky waveform clip. */
export const WAVEFORM_TIER_VIEWPORT_WIDTH_VAR = "--waveform-tier-viewport-width";

export function tierViewportWidthStyle(fallbackPx: number): { width: string } {
  const fallback = Math.max(1, fallbackPx);
  return { width: `var(${WAVEFORM_TIER_VIEWPORT_WIDTH_VAR}, ${fallback}px)` };
}

/** Stretch painted waveform to visual shell height while WaveSurfer redraw is pending. */
export function resolveWaveformVerticalScalePreview(
  visualHeightPx: number,
  paintedHeightPx: number,
): { scale: number; active: boolean; transform: string | undefined } {
  const painted = Math.max(1, paintedHeightPx);
  const visual = Math.max(1, visualHeightPx);
  const scale = visual / painted;
  const active = Math.abs(scale - 1) > 0.001;
  return {
    scale,
    active,
    transform: active ? `scaleY(${scale})` : undefined,
  };
}

export function writeWaveformTierViewportWidthVar(
  tierEl: HTMLElement,
  viewportWidthPx: number,
): void {
  if (viewportWidthPx > 0) {
    tierEl.style.setProperty(WAVEFORM_TIER_VIEWPORT_WIDTH_VAR, `${viewportWidthPx}px`);
  }
}

/** Read the widest known tier viewport width (live ref > DOM > committed layout). */
export function resolveTierViewportWidthPx(input: {
  tierScrollEl?: HTMLElement | null;
  layoutClientWidthPx?: number;
  liveClientWidthPx?: number;
}): number {
  const live = input.liveClientWidthPx ?? 0;
  const tier = input.tierScrollEl?.clientWidth ?? 0;
  const layout = input.layoutClientWidthPx ?? 0;
  return Math.max(live, tier, layout);
}

/** Prefer live tier DOM scroll; fall back to live ref then committed layout. */
export function resolveTierScrollLeftPx(input: {
  tierScrollEl?: HTMLElement | null;
  layoutScrollLeftPx: number;
  liveScrollLeftRef?: RefObject<number>;
}): number {
  const domScrollLeft = input.tierScrollEl?.scrollLeft;
  if (domScrollLeft != null && Number.isFinite(domScrollLeft)) {
    return domScrollLeft;
  }
  const live = input.liveScrollLeftRef?.current;
  if (live != null && Number.isFinite(live)) return live;
  return input.layoutScrollLeftPx;
}

/** Single read path for overlay / minimap / playback chrome (TRUTH-006/009/023). */
export function resolveTierViewportMetrics(input: {
  tierScrollEl?: HTMLElement | null;
  tierScrollLive?: TierScrollLiveRefs;
  tierScrollLayout: TierScrollLayoutMetrics;
}): { scrollLeftPx: number; viewportWidthPx: number } {
  const tier = input.tierScrollEl;
  return {
    scrollLeftPx: resolveTierScrollLeftPx({
      tierScrollEl: tier,
      layoutScrollLeftPx: input.tierScrollLayout.scrollLeftPx,
      liveScrollLeftRef: input.tierScrollLive?.scrollLeftRef,
    }),
    viewportWidthPx: Math.max(
      1,
      resolveTierViewportWidthPx({
        tierScrollEl: tier,
        layoutClientWidthPx: input.tierScrollLayout.clientWidthPx,
        liveClientWidthPx: input.tierScrollLive?.clientWidthRef.current,
      }),
    ),
  };
}

export function resolveWaveformRulerView(input: {
  durationSec: number;
  scrollLeftPx: number;
  clientWidthPx: number;
  timelineWidthPx: number;
}): WaveformRulerView | null {
  const dur = Math.max(0, input.durationSec);
  if (dur <= 0) return null;
  return visibleTimeWindowFromScroll({
    scrollLeftPx: input.scrollLeftPx,
    viewportWidthPx: input.clientWidthPx,
    timelineWidthPx: input.timelineWidthPx,
    durationSec: dur,
  });
}
