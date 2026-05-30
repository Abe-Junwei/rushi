import { useEffect, type RefObject } from "react";

/** Forward horizontal wheel from the waveform area to tier scroll (ADR-0005). */
export function useWaveformTierWheelForward(input: {
  waveformShellRef: RefObject<HTMLElement | null>;
  tierScrollRef: RefObject<HTMLElement | null>;
  enabled: boolean;
}): void {
  useEffect(() => {
    if (!input.enabled) return;
    const tier = input.tierScrollRef.current;
    const shell = input.waveformShellRef.current;
    if (!tier) return;

    const onWheel = (e: WheelEvent) => {
      let delta = e.deltaX;
      if (!delta && e.shiftKey) {
        delta = e.deltaY;
      }
      if (!delta) return;
      tier.scrollLeft += delta;
      e.preventDefault();
    };

    tier.addEventListener("wheel", onWheel, { passive: false });
    shell?.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      tier.removeEventListener("wheel", onWheel);
      shell?.removeEventListener("wheel", onWheel);
    };
  }, [input.enabled, input.tierScrollRef, input.waveformShellRef]);
}
