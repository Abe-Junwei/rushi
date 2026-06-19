import { useEffect, type RefObject } from "react";

const WAVEFORM_TIER_WHEEL_LINE_PX = 32;
const WAVEFORM_TIER_WHEEL_PAGE_PX = 320;
const WAVEFORM_TIER_WHEEL_MAX_DELTA_PX = 240;

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
  onWheelScrollDelta: (deltaPx: number) => void;
  onCancelScrollMotion: () => void;
}): void {
  /* eslint-disable react-hooks/exhaustive-deps -- `input` is a stable args object; we list the used primitive/refs fields in deps */
  useEffect(() => {
    if (!input.enabled) return;
    const tier = input.tierScrollRef.current;
    const shell = input.waveformShellRef.current;
    if (!tier) return;

    const onWheel = (e: WheelEvent) => {
      const delta = resolveWaveformTierWheelScrollDelta(e);
      if (!delta) return;
      e.preventDefault();
      e.stopPropagation();
      input.onWheelScrollDelta(delta);
    };

    const opts: AddEventListenerOptions = { passive: false, capture: true };
    const pointerOpts: AddEventListenerOptions = { passive: true, capture: true };
    tier.addEventListener("wheel", onWheel, opts);
    shell?.addEventListener("wheel", onWheel, opts);
    tier.addEventListener("pointerdown", input.onCancelScrollMotion, pointerOpts);
    shell?.addEventListener("pointerdown", input.onCancelScrollMotion, pointerOpts);
    return () => {
      tier.removeEventListener("wheel", onWheel, opts);
      shell?.removeEventListener("wheel", onWheel, opts);
      tier.removeEventListener("pointerdown", input.onCancelScrollMotion, pointerOpts);
      shell?.removeEventListener("pointerdown", input.onCancelScrollMotion, pointerOpts);
    };
  }, [
    input.enabled,
    input.onCancelScrollMotion,
    input.onWheelScrollDelta,
    input.tierScrollRef,
    input.waveformShellRef,
  ]);
  /* eslint-enable react-hooks/exhaustive-deps */
}
