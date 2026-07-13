import { useLayoutEffect, type MutableRefObject, type RefObject } from "react";
import type { useTierScrollProgrammaticWrites } from "./tierScrollProgrammaticWrites";
import { peekFileViewRestoreForFile } from "../services/fileViewStateBridge";
import { shouldSkipMediaResetForFileViewRestore } from "./useFileViewStateRestoreEffect";

export function useTierScrollMediaResetEffect(args: {
  fileId: string | null;
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
    if (shouldSkipMediaResetForFileViewRestore(peekFileViewRestoreForFile(args.fileId), args.fileId)) {
      return;
    }
    args.committedScrollLeftRef.current = 0;
    args.liveScrollLeftRef.current = 0;
    args.programmaticWrites.resetOnMediaUrlChange(args.tierScrollRef.current);
  }, [
    args.fileId,
    args.mediaUrl,
    args.prevMediaUrlResetOnlyRef,
    args.committedScrollLeftRef,
    args.liveScrollLeftRef,
    args.programmaticWrites,
    args.tierScrollRef,
  ]);
}
