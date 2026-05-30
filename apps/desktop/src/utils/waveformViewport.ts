import { visibleTimeWindowFromScroll } from "./waveformProjection";

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
