import { useEffect, type RefObject } from "react";
import { setDirectLayoutStyle } from "./cspElementLayout";
import { subscribeTierScrollFrame } from "./tierScrollFrameCoordinator";
import {
  resolveTierScrollLeftPx,
  type TierScrollLiveRefs,
} from "./waveformViewport";

/**
 * Pin viewport-chrome layers to the tier scrollport without CSS `position: sticky`.
 *
 * WKWebView can promote `sticky` (even `left-0` only) onto a compositor layer that
 * paints over `EditorToolbar`. Absolute + `translate3d(scrollLeft,0,0)` cancels
 * native scroll of the timeline shell and keeps chrome in the visible viewport.
 */
export function syncWaveformScrollPinnedLayers(args: {
  layers: Array<HTMLElement | null | undefined>;
  scrollLeftPx: number;
}): void {
  const x = Number.isFinite(args.scrollLeftPx) ? args.scrollLeftPx : 0;
  const transform = `translate3d(${x}px, 0, 0)`;
  for (const el of args.layers) {
    if (!el) continue;
    setDirectLayoutStyle(el, { transform });
  }
}

export function useWaveformScrollPinnedLayers(args: {
  layerRefs: Array<RefObject<HTMLElement | null>>;
  tierScrollRef: RefObject<HTMLElement | null>;
  tierScrollLive?: TierScrollLiveRefs;
  layoutScrollLeftPx: number;
}): void {
  const { layerRefs, tierScrollRef, tierScrollLive, layoutScrollLeftPx } = args;

  useEffect(() => {
    const apply = () => {
      const scrollLeftPx = resolveTierScrollLeftPx({
        tierScrollEl: tierScrollRef.current,
        layoutScrollLeftPx,
        liveScrollLeftRef: tierScrollLive?.scrollLeftRef,
      });
      syncWaveformScrollPinnedLayers({
        layers: layerRefs.map((r) => r.current),
        scrollLeftPx,
      });
    };
    apply();
    return subscribeTierScrollFrame(apply);
  }, [layerRefs, layoutScrollLeftPx, tierScrollLive, tierScrollRef]);
}
