import { useCallback, useRef, type RefObject } from "react";
import { clampTimelineScrollLeftPx } from "../utils/waveformScrollSync";

export function useTierScrollWheelMotion(args: {
  tierScrollRef: RefObject<HTMLDivElement | null>;
  getTimelineWidthPx: () => number;
  commitWheelScrollFrame: (scrollLeftPx: number) => void;
}) {
  const argsRef = useRef(args);
  argsRef.current = args;

  const wheelMotionRef = useRef({ raf: 0, animating: false });

  const cancelWheelMotion = useCallback(() => {
    const wheelMotion = wheelMotionRef.current;
    if (wheelMotion.raf) {
      cancelAnimationFrame(wheelMotion.raf);
      wheelMotion.raf = 0;
    }
    wheelMotion.animating = false;
  }, []);

  const applyWheelScrollDelta = useCallback((deltaPx: number) => {
    const tier = argsRef.current.tierScrollRef.current;
    if (!tier || deltaPx === 0) return;
    cancelWheelMotion();
    const next = clampTimelineScrollLeftPx({
      scrollLeftPx: tier.scrollLeft + deltaPx,
      timelineWidthPx: argsRef.current.getTimelineWidthPx(),
      viewportWidthPx: tier.clientWidth,
    });
    if (next !== tier.scrollLeft) {
      argsRef.current.commitWheelScrollFrame(next);
    }
  }, [cancelWheelMotion]);

  return { applyWheelScrollDelta, cancelWheelMotion };
};
