import { useLayoutEffect, useReducer, useRef, type RefObject } from "react";
import {
  resolveTierViewportMetrics,
  type TierScrollLayoutMetrics,
  type TierScrollLiveRefs,
} from "../utils/waveformViewport";

export type UseTierViewportMetricsFrameInput = {
  tierScrollRef: RefObject<HTMLElement | null>;
  tierScrollLive: TierScrollLiveRefs;
  tierScrollLayout: TierScrollLayoutMetrics;
  /**
   * When false, tier scroll/wheel only sync live refs — skip React re-render.
   * Use during playback scroll-follow; pair with imperative overlay paint (rAF).
   */
  commitScrollFrame?: boolean;
};

/** Tier viewport metrics that re-render on tier scroll / resize (TRUTH-006). */
export function useTierViewportMetricsFrame(input: UseTierViewportMetricsFrameInput): {
  scrollLeftPx: number;
  viewportWidthPx: number;
} {
  const commitScrollFrame = input.commitScrollFrame ?? true;
  const inputRef = useRef(input);
  inputRef.current = input;
  const commitScrollFrameRef = useRef(commitScrollFrame);
  commitScrollFrameRef.current = commitScrollFrame;
  const [scrollFrame, bumpScrollFrame] = useReducer((n: number) => n + 1, 0);
  const lastCommittedClientWidthPxRef = useRef(input.tierScrollLayout.clientWidthPx);

  useLayoutEffect(() => {
    const el = input.tierScrollRef.current;
    if (!el) return;

    const syncLiveRefs = () => {
      const tier = inputRef.current.tierScrollRef.current;
      if (!tier) return;
      const live = inputRef.current.tierScrollLive;
      live.scrollLeftRef.current = tier.scrollLeft;
      live.clientWidthRef.current = tier.clientWidth;
    };

    const notify = () => {
      syncLiveRefs();
      if (!commitScrollFrameRef.current) return;
      bumpScrollFrame();
    };

    syncLiveRefs();
    const clientWidthPx = inputRef.current.tierScrollLayout.clientWidthPx;
    const clientWidthChanged =
      Math.abs(clientWidthPx - lastCommittedClientWidthPxRef.current) > 0.5;
    if (clientWidthChanged) {
      lastCommittedClientWidthPxRef.current = clientWidthPx;
    }
    if (commitScrollFrameRef.current && clientWidthChanged) {
      bumpScrollFrame();
    }

    el.addEventListener("scroll", notify, { passive: true });
    el.addEventListener("wheel", notify, { passive: true });
    window.addEventListener("resize", notify);
    return () => {
      el.removeEventListener("scroll", notify);
      el.removeEventListener("wheel", notify);
      window.removeEventListener("resize", notify);
    };
  }, [input.tierScrollRef, input.tierScrollLayout.clientWidthPx]);

  void scrollFrame;
  return resolveTierViewportMetrics({
    tierScrollEl: inputRef.current.tierScrollRef.current,
    tierScrollLive: inputRef.current.tierScrollLive,
    tierScrollLayout: inputRef.current.tierScrollLayout,
  });
}
