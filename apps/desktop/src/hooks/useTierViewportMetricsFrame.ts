import { useLayoutEffect, useReducer, useRef, type RefObject } from "react";
import {
  resolveTierViewportMetrics,
  type TierScrollLayoutMetrics,
  type TierScrollLiveRefs,
} from "../utils/waveformViewport";

/** Tier viewport metrics that re-render on every tier scroll / resize (TRUTH-006). */
export function useTierViewportMetricsFrame(input: {
  tierScrollRef: RefObject<HTMLElement | null>;
  tierScrollLive: TierScrollLiveRefs;
  tierScrollLayout: TierScrollLayoutMetrics;
}): { scrollLeftPx: number; viewportWidthPx: number } {
  const inputRef = useRef(input);
  inputRef.current = input;
  const [scrollFrame, bumpScrollFrame] = useReducer((n: number) => n + 1, 0);

  useLayoutEffect(() => {
    const el = input.tierScrollRef.current;
    if (!el) return;
    const notify = () => {
      const el = inputRef.current.tierScrollRef.current;
      if (el) {
        const live = inputRef.current.tierScrollLive;
        live.scrollLeftRef.current = el.scrollLeft;
        live.clientWidthRef.current = el.clientWidth;
      }
      bumpScrollFrame();
    };
    notify();
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
