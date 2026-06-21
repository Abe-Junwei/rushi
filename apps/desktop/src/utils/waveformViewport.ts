import type { RefObject } from "react";
import { logRuntimeParity } from "../services/runtimeParity";
import { isTierScrollFrameActive, readTierViewportMetricsDuringScrollFrame } from "./tierScrollFrameCoordinator";
import { setCspLayoutRules } from "./cspElementLayout";

export type TierScrollLiveRefs = {
  scrollLeftRef: RefObject<number>;
  clientWidthRef: RefObject<number>;
};

export type TierScrollLayoutMetrics = {
  scrollLeftPx: number;
  clientWidthPx: number;
};

/** Tier scrollport width — set imperatively on the tier element for sticky waveform clip. */
export const WAVEFORM_TIER_VIEWPORT_WIDTH_VAR = "--waveform-tier-viewport-width";

export const WAVEFORM_TIER_VIEWPORT_WIDTH_CLASS = "waveform-tier-viewport-width";

/** Segment chrome height during drag/preview — match visual shell, not deferred painted height. */
export function resolveWaveformSegmentLayoutHeightPx(
  visualHeightPx: number,
  paintedHeightPx: number,
  previewActive: boolean,
): number {
  const visual = Math.max(1, visualHeightPx);
  const painted = Math.max(1, paintedHeightPx);
  return previewActive ? visual : painted;
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
    setCspLayoutRules(tierEl, {
      [WAVEFORM_TIER_VIEWPORT_WIDTH_VAR]: `${viewportWidthPx}px`,
    });
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

/** Scroll-frame subscribers: prefer per-frame snapshot; fall back to DOM-first read. */
let devWarnedMissingScrollFrameSnapshot = false;

export function resolveTierViewportMetricsDuringScrollFrame(input: {
  tierScrollEl?: HTMLElement | null;
  tierScrollLive?: TierScrollLiveRefs;
  tierScrollLayout: TierScrollLayoutMetrics;
}): { scrollLeftPx: number; viewportWidthPx: number } {
  const snapshot = readTierViewportMetricsDuringScrollFrame();
  if (snapshot) return snapshot;
  if (isTierScrollFrameActive() && !devWarnedMissingScrollFrameSnapshot) {
    devWarnedMissingScrollFrameSnapshot = true;
    logRuntimeParity(
      "waveform",
      "scroll-frame subscriber read metrics without snapshot; falling back to DOM",
      "WARN",
    );
  }
  return resolveTierViewportMetrics(input);
}
