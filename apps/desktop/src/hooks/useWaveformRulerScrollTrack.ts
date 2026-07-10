import { useLayoutEffect, type RefObject } from "react";
import { setDirectLayoutStyle } from "../utils/cspElementLayout";
import { subscribeTierScrollFrame } from "../utils/tierScrollFrameCoordinator";
import { resolveTierScrollLeftPx } from "../utils/waveformViewport";

type UseWaveformRulerScrollTrackArgs = {
  enabled: boolean;
  tierScrollRef?: RefObject<HTMLElement | null>;
  tierScrollLive?: { scrollLeftRef: RefObject<number> };
  scrollTrackRef: RefObject<HTMLElement | null>;
  timelineWidthPx: number;
  onTickRebuild?: (scrollLeftPx: number) => void;
};

/** DOM-first scroll read, aligned with overlay / band / playhead (`resolveTierViewportMetrics`). */
function readTierScrollLeftPx(
  scrollEl: HTMLElement,
  tierScrollLive?: { scrollLeftRef: RefObject<number> },
): number {
  return resolveTierScrollLeftPx({
    tierScrollEl: scrollEl,
    layoutScrollLeftPx: 0,
    liveScrollLeftRef: tierScrollLive?.scrollLeftRef,
  });
}

/** Imperative translate3d sync — ruler track moves with tier scroll without React paint. */
export function useWaveformRulerScrollTrack({
  enabled,
  tierScrollRef,
  tierScrollLive,
  scrollTrackRef,
  timelineWidthPx,
  onTickRebuild,
}: UseWaveformRulerScrollTrackArgs): void {
  useLayoutEffect(() => {
    if (!enabled) return;
    const scrollEl = tierScrollRef?.current;
    const track = scrollTrackRef.current;
    if (!scrollEl || !track) return;

    let lastTickBuildScrollPx = readTierScrollLeftPx(scrollEl, tierScrollLive);
    let tickRebuildRaf = 0;

    const applyTransform = () => {
      const scrollLeftPx = readTierScrollLeftPx(scrollEl, tierScrollLive);
      setDirectLayoutStyle(track, { transform: `translate3d(${-scrollLeftPx}px, 0, 0)` });

      if (!onTickRebuild) return;
      if (Math.abs(scrollLeftPx - lastTickBuildScrollPx) < 1) return;
      if (tickRebuildRaf) return;
      tickRebuildRaf = requestAnimationFrame(() => {
        tickRebuildRaf = 0;
        lastTickBuildScrollPx = readTierScrollLeftPx(scrollEl, tierScrollLive);
        onTickRebuild(lastTickBuildScrollPx);
      });
    };

    applyTransform();
    const unsubFrame = subscribeTierScrollFrame(applyTransform);
    window.addEventListener("resize", applyTransform);

    return () => {
      unsubFrame();
      window.removeEventListener("resize", applyTransform);
      if (tickRebuildRaf) cancelAnimationFrame(tickRebuildRaf);
      setDirectLayoutStyle(track, { transform: undefined });
    };
  }, [
    enabled,
    onTickRebuild,
    scrollTrackRef,
    tierScrollLive,
    tierScrollRef,
    timelineWidthPx,
  ]);
}

export function applyWaveformRulerScrollTrackTransform(
  scrollEl: HTMLElement | null,
  track: HTMLElement | null,
  tierScrollLive?: { scrollLeftRef: RefObject<number> },
): void {
  if (!scrollEl || !track) return;
  const scrollLeftPx = readTierScrollLeftPx(scrollEl, tierScrollLive);
  setDirectLayoutStyle(track, { transform: `translate3d(${-scrollLeftPx}px, 0, 0)` });
}
