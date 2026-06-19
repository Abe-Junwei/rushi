import { useEffect, type RefObject } from "react";
import { flushTierScrollFrame } from "../utils/tierScrollFrameCoordinator";

/**
 * Fixed wheel gain (no user pref). Trackpad pixel deltas at 1:1 feel sluggish on long timelines.
 */
export const WAVEFORM_TIER_WHEEL_SCROLL_GAIN = 2.5;

/**
 * Per-frame approach factor toward the accumulated wheel target. <1 so current monotonically
 * approaches target (no overshoot); higher = snappier, lower = smoother.
 */
export const WAVEFORM_TIER_WHEEL_SMOOTH_LERP_FACTOR = 0.4;

/** Snap to target and stop the rAF loop when within this distance. */
export const WAVEFORM_TIER_WHEEL_SMOOTH_SNAP_EPSILON_PX = 0.5;

/** Resolve wheel delta for horizontal tier scroll (trackpad vertical swipe pans the timeline). */
export function resolveWaveformTierWheelScrollDelta(e: WheelEvent): number {
  const raw = Math.abs(e.deltaX) >= Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
  if (!raw) return 0;
  return Math.round(raw * WAVEFORM_TIER_WHEEL_SCROLL_GAIN);
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

    // Accumulate wheel deltas into a target and ease toward it per frame so rapid mouse-wheel
    // notches glide instead of stepping, and multiple same-frame events coalesce into one write.
    let targetLeft = tier.scrollLeft;
    let raf = 0;
    let animating = false;

    const clampTarget = (value: number): number => {
      const max = Math.max(0, tier.scrollWidth - tier.clientWidth);
      return Math.max(0, Math.min(max, value));
    };

    // Sync live refs (onTierScroll) then repaint sticky chrome in THIS frame, so the JS-followed
    // sticky layers (segment band / playhead / ruler) stay aligned with the natively-scrolled
    // waveform + overlay instead of trailing by one frame.
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
      // Continue from the in-flight target while animating; otherwise re-anchor to the real DOM
      // position (drag/playback-follow may have moved it since the last wheel burst).
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
  }, [input.enabled, input.onTierScroll, input.tierScrollRef, input.waveformShellRef]);
  /* eslint-enable react-hooks/exhaustive-deps */
}
