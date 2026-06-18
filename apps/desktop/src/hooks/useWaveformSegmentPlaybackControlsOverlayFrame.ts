import { useLayoutEffect, useRef, type RefObject } from "react";
import { clearCspLayoutRules, setCspLayoutRules } from "../utils/cspElementLayout";
import { resolveSegmentPlaybackControlsOverlayLayout } from "../utils/waveformRegionActionOverlay";
import {
  resolveTierViewportMetrics,
  type TierScrollLayoutMetrics,
  type TierScrollLiveRefs,
} from "../utils/waveformViewport";

export function useWaveformSegmentPlaybackControlsOverlayFrame(args: {
  enabled: boolean;
  overlayRef: RefObject<HTMLDivElement | null>;
  tierScrollRef: RefObject<HTMLElement | null>;
  tierScrollLive: TierScrollLiveRefs;
  tierScrollLayout: TierScrollLayoutMetrics;
  segmentStartSec: number;
  segmentEndSec: number;
  timelineWidthPx: number;
  durationSec: number;
}): void {
  const argsRef = useRef(args);
  argsRef.current = args;

  useLayoutEffect(() => {
    if (!args.enabled) return;

    let raf = 0;

    const paint = () => {
      raf = 0;
      const a = argsRef.current;
      const overlay = a.overlayRef.current;
      const tier = a.tierScrollRef.current;
      if (!overlay || !tier) {
        raf = requestAnimationFrame(paint);
        return;
      }

      const { scrollLeftPx, viewportWidthPx } = resolveTierViewportMetrics({
        tierScrollEl: tier,
        tierScrollLive: a.tierScrollLive,
        tierScrollLayout: a.tierScrollLayout,
      });
      const layout = resolveSegmentPlaybackControlsOverlayLayout({
        segmentStartSec: a.segmentStartSec,
        segmentEndSec: a.segmentEndSec,
        timelineWidthPx: a.timelineWidthPx,
        durationSec: a.durationSec,
        scrollLeftPx,
        viewportWidthPx,
      });

      if (!layout.visible) {
        overlay.classList.add("hidden");
        clearCspLayoutRules(overlay);
      } else {
        overlay.classList.remove("hidden");
        setCspLayoutRules(overlay, {
          display: "flex",
          left: layout.overlayLeftPx,
          width: layout.overlayWidthPx,
        });
      }

      raf = requestAnimationFrame(paint);
    };

    paint();

    return () => {
      if (raf) cancelAnimationFrame(raf);
      const overlay = argsRef.current.overlayRef.current;
      if (overlay) {
        overlay.classList.remove("hidden");
        clearCspLayoutRules(overlay);
      }
    };
  }, [
    args.durationSec,
    args.enabled,
    args.overlayRef,
    args.segmentEndSec,
    args.segmentStartSec,
    args.timelineWidthPx,
    args.tierScrollLayout.clientWidthPx,
    args.tierScrollRef,
  ]);
}
