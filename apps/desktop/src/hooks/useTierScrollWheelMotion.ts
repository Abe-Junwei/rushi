import { useCallback, useRef, type RefObject } from "react";
import { clampTimelineScrollLeftPx } from "../utils/waveformScrollSync";

const WAVEFORM_TIER_WHEEL_SMOOTH_LERP_FACTOR = 0.4;
const WAVEFORM_TIER_WHEEL_SMOOTH_SNAP_EPSILON_PX = 0.5;

export function useTierScrollWheelMotion(args: {
  tierScrollRef: RefObject<HTMLDivElement | null>;
  getTimelineWidthPx: () => number;
  commitWheelScrollFrame: (scrollLeftPx: number) => void;
}) {
  const argsRef = useRef(args);
  argsRef.current = args;

  const wheelMotionRef = useRef({ targetLeft: 0, raf: 0, animating: false });

  const cancelWheelMotion = useCallback(() => {
    const wheelMotion = wheelMotionRef.current;
    if (wheelMotion.raf) {
      cancelAnimationFrame(wheelMotion.raf);
      wheelMotion.raf = 0;
    }
    const tier = argsRef.current.tierScrollRef.current;
    wheelMotion.targetLeft = tier?.scrollLeft ?? wheelMotion.targetLeft;
    wheelMotion.animating = false;
  }, []);

  const applyWheelScrollDelta = useCallback((deltaPx: number) => {
    const tier = argsRef.current.tierScrollRef.current;
    if (!tier) return;
    const wheelMotion = wheelMotionRef.current;
    const clampTarget = (value: number): number => {
      const vw = tier.clientWidth;
      return clampTimelineScrollLeftPx({
        scrollLeftPx: value,
        timelineWidthPx: argsRef.current.getTimelineWidthPx(),
        viewportWidthPx: vw,
      });
    };
    const step = () => {
      wheelMotion.raf = 0;
      const current = tier.scrollLeft;
      const diff = wheelMotion.targetLeft - current;
      if (Math.abs(diff) <= WAVEFORM_TIER_WHEEL_SMOOTH_SNAP_EPSILON_PX) {
        if (current !== wheelMotion.targetLeft) {
          argsRef.current.commitWheelScrollFrame(wheelMotion.targetLeft);
        }
        wheelMotion.animating = false;
        return;
      }
      argsRef.current.commitWheelScrollFrame(current + diff * WAVEFORM_TIER_WHEEL_SMOOTH_LERP_FACTOR);
      wheelMotion.raf = requestAnimationFrame(step);
    };
    const base = wheelMotion.animating ? wheelMotion.targetLeft : tier.scrollLeft;
    wheelMotion.targetLeft = clampTarget(base + deltaPx);
    if (!wheelMotion.animating) {
      wheelMotion.animating = true;
      wheelMotion.raf = requestAnimationFrame(step);
    }
  }, []);

  return { applyWheelScrollDelta, cancelWheelMotion };
}
