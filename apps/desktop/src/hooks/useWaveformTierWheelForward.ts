import { useEffect, type RefObject } from "react";

/** Resolve wheel delta for horizontal tier scroll (trackpad vertical swipe pans the timeline). */
export function resolveWaveformTierWheelScrollDelta(e: WheelEvent): number {
  if (Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return e.deltaX;
  return e.deltaY;
}

/** Forward wheel from the waveform area to tier scroll (ADR-0005). */
export function useWaveformTierWheelForward(input: {
  waveformShellRef: RefObject<HTMLElement | null>;
  tierScrollRef: RefObject<HTMLElement | null>;
  enabled: boolean;
  /** Imperative tier scroll writes do not always emit `scroll` — sync overlay/layout here. */
  onTierScroll?: () => void;
}): void {
  useEffect(() => {
    if (!input.enabled) return;
    const tier = input.tierScrollRef.current;
    const shell = input.waveformShellRef.current;
    if (!tier) return;

    const onWheel = (e: WheelEvent) => {
      const delta = resolveWaveformTierWheelScrollDelta(e);
      if (!delta) return;
      tier.scrollLeft += delta;
      input.onTierScroll?.();
      e.preventDefault();
      e.stopPropagation();
    };

    const opts: AddEventListenerOptions = { passive: false, capture: true };
    tier.addEventListener("wheel", onWheel, opts);
    shell?.addEventListener("wheel", onWheel, opts);
    return () => {
      tier.removeEventListener("wheel", onWheel, opts);
      shell?.removeEventListener("wheel", onWheel, opts);
    };
  }, [input.enabled, input.onTierScroll, input.tierScrollRef, input.waveformShellRef]);
}
