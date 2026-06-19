import { useEffect, type RefObject } from "react";
import { flushTierScrollFrame } from "../utils/tierScrollFrameCoordinator";

const WAVEFORM_TIER_WHEEL_LINE_PX = 32;
const WAVEFORM_TIER_WHEEL_PAGE_PX = 320;
const WAVEFORM_TIER_WHEEL_MAX_DELTA_PX = 240;
const WAVEFORM_TIER_WHEEL_SMOOTH_LERP_FACTOR = 0.4;
const WAVEFORM_TIER_WHEEL_SMOOTH_SNAP_EPSILON_PX = 0.5;

/** Resolve wheel delta for horizontal tier scroll (trackpad vertical swipe pans the timeline). */
export function resolveWaveformTierWheelScrollDelta(e: WheelEvent): number {
  const raw = Math.abs(e.deltaX) >= Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
  if (!raw) return 0;
  const px =
    e.deltaMode === 1
      ? raw * WAVEFORM_TIER_WHEEL_LINE_PX
      : e.deltaMode === 2
        ? raw * WAVEFORM_TIER_WHEEL_PAGE_PX
        : raw;
  return Math.round(Math.max(-WAVEFORM_TIER_WHEEL_MAX_DELTA_PX, Math.min(WAVEFORM_TIER_WHEEL_MAX_DELTA_PX, px)));
}

/** Forward wheel from the waveform area to tier scroll (ADR-0005). */
export function useWaveformTierWheelForward(input: {
  waveformShellRef: RefObject<HTMLElement | null>;
  tierScrollRef: RefObject<HTMLElement | null>;
  enabled: boolean;
  /** Imperative tier scroll writes do not always emit `scroll` — sync overlay/layout here. */
  onTierScroll?: () => void;
}): void {
  /* eslint-disable react-hooks/exhaustive-deps -- `input` is a stable args object; we list the used primitive/refs fields in deps */
  useEffect(() => {
    if (!input.enabled) return;
    const tier = input.tierScrollRef.current;
    const shell = input.waveformShellRef.current;
    if (!tier) return;

    const clampTarget = (value: number): number => {
      const max = Math.max(0, tier.scrollWidth - tier.clientWidth);
      return Math.max(0, Math.min(max, value));
    };

    let targetLeft = tier.scrollLeft;
    let raf = 0;
    let animating = false;

    const commitScroll = () => {
      input.onTierScroll?.();
      flushTierScrollFrame();
    };

    const step = () => {
      raf = 0;
      const current = tier.scrollLeft;
      const diff = targetLeft - current;
      if (Math.abs(diff) <= WAVEFORM_TIER_WHEEL_SMOOTH_SNAP_EPSILON_PX) {
        if (current !== targetLeft) {
          tier.scrollLeft = targetLeft;
          commitScroll();
        }
        animating = false;
        return;
      }
      tier.scrollLeft = current + diff * WAVEFORM_TIER_WHEEL_SMOOTH_LERP_FACTOR;
      commitScroll();
      raf = requestAnimationFrame(step);
    };

    const onWheel = (e: WheelEvent) => {
      const delta = resolveWaveformTierWheelScrollDelta(e);
      if (!delta) return;
      e.preventDefault();
      e.stopPropagation();
      const base = animating ? targetLeft : tier.scrollLeft;
      targetLeft = clampTarget(base + delta);
      if (!animating) {
        animating = true;
        raf = requestAnimationFrame(step);
      }
    };

    const opts: AddEventListenerOptions = { passive: false, capture: true };
    tier.addEventListener("wheel", onWheel, opts);
    shell?.addEventListener("wheel", onWheel, opts);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      animating = false;
      tier.removeEventListener("wheel", onWheel, opts);
      shell?.removeEventListener("wheel", onWheel, opts);
    };
  }, [
    input.enabled,
    input.onTierScroll,
    input.tierScrollRef,
    input.waveformShellRef,
  ]);
  /* eslint-enable react-hooks/exhaustive-deps */
}
