import { useLayoutEffect, type RefObject } from "react";

type UseWaveformRulerScrollTrackArgs = {
  enabled: boolean;
  tierScrollRef?: RefObject<HTMLElement | null>;
  tierScrollLive?: { scrollLeftRef: RefObject<number> };
  scrollTrackRef: RefObject<HTMLElement | null>;
  timelineWidthPx: number;
  onTickRebuild?: (scrollLeftPx: number) => void;
};

function readTierScrollLeftPx(
  scrollEl: HTMLElement,
  tierScrollLive?: { scrollLeftRef: RefObject<number> },
): number {
  const live = tierScrollLive?.scrollLeftRef.current;
  if (live != null && Number.isFinite(live)) return live;
  return scrollEl.scrollLeft;
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
      track.style.transform = `translate3d(${-scrollLeftPx}px, 0, 0)`;

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
    scrollEl.addEventListener("scroll", applyTransform, { passive: true });
    window.addEventListener("resize", applyTransform);

    return () => {
      scrollEl.removeEventListener("scroll", applyTransform);
      window.removeEventListener("resize", applyTransform);
      if (tickRebuildRaf) cancelAnimationFrame(tickRebuildRaf);
      track.style.removeProperty("transform");
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
  track.style.transform = `translate3d(${-scrollLeftPx}px, 0, 0)`;
}
