import { useLayoutEffect, useRef, type MutableRefObject, type RefObject } from "react";
import { flushTierScrollFrame } from "../utils/tierScrollFrameCoordinator";

export function useTierScrollDomActivity(args: {
  tierScrollRef: RefObject<HTMLDivElement | null>;
  syncScrollFromTierDom: () => void;
  notifyScrollActivity: () => void;
  suppressPlaybackFollowForScrollEvent: () => void;
  shouldCancelTransientScrollMotion?: () => boolean;
  cancelTransientScrollMotion?: () => void;
  programmaticScrollUntilRef: MutableRefObject<number>;
}) {
  const activityRef = useRef({
    syncScrollFromTierDom: () => {},
    notifyScrollActivity: () => {},
  });
  activityRef.current = {
    syncScrollFromTierDom: args.syncScrollFromTierDom,
    notifyScrollActivity: args.notifyScrollActivity,
  };

  /* eslint-disable react-hooks/exhaustive-deps -- suppressPlaybackFollowForUserScroll is stable; programmaticScrollUntilRef is a stable ref */
  useLayoutEffect(() => {
    const tier = args.tierScrollRef.current;
    if (!tier) return;
    const onScroll = () => {
      if (args.shouldCancelTransientScrollMotion?.()) {
        args.cancelTransientScrollMotion?.();
      }
      activityRef.current.syncScrollFromTierDom();
      activityRef.current.notifyScrollActivity();
      args.suppressPlaybackFollowForScrollEvent();
      flushTierScrollFrame();
    };
    tier.addEventListener("scroll", onScroll, { passive: true });
    return () => tier.removeEventListener("scroll", onScroll);
  }, [args.tierScrollRef, args.programmaticScrollUntilRef]);
  /* eslint-enable react-hooks/exhaustive-deps */

  return activityRef;
}
