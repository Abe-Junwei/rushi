import { useLayoutEffect, type MutableRefObject, type RefObject } from "react";
import type { useTierScrollProgrammaticWrites } from "./tierScrollProgrammaticWrites";

export function useTierScrollMediaResetEffect(args: {
  mediaUrl: string | null;
  tierScrollRef: RefObject<HTMLDivElement | null>;
  committedScrollLeftRef: MutableRefObject<number>;
  liveScrollLeftRef: MutableRefObject<number>;
  prevMediaUrlResetOnlyRef: MutableRefObject<string | null>;
  programmaticWrites: ReturnType<typeof useTierScrollProgrammaticWrites>;
}) {
  useLayoutEffect(() => {
    const isMediaUrlChange = args.prevMediaUrlResetOnlyRef.current !== args.mediaUrl;
    if (!isMediaUrlChange) return;
    args.prevMediaUrlResetOnlyRef.current = args.mediaUrl;
    args.committedScrollLeftRef.current = 0;
    args.liveScrollLeftRef.current = 0;
    args.programmaticWrites.resetOnMediaUrlChange(args.tierScrollRef.current);
  }, [args]);
}
