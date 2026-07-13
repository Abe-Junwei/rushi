import { useLayoutEffect, useRef } from "react";
import { scrollPxCenterTimeInViewport } from "../utils/waveformProjection";
import { peekFileViewRestoreForFile } from "../services/fileViewStateBridge";
import { shouldSkipMediaResetForFileViewRestore } from "./useFileViewStateRestoreEffect";
import type { useTierScrollProgrammaticWrites } from "./tierScrollProgrammaticWrites";

type ProgrammaticWrites = ReturnType<typeof useTierScrollProgrammaticWrites>;

type TierScrollResizeEffectArgs = {
  fileId?: string | null;
  mediaUrl: string | null;
  timelineWidthPx: number;
  waveformReady: boolean;
  mediaDurationSec: number;
  pxPerSec: number;
  clientWidthPx: number;
  tierScrollRef: React.RefObject<HTMLDivElement | null>;
  committedScrollLeftRef: React.MutableRefObject<number>;
  prevMediaUrlRef: React.MutableRefObject<string | null>;
  prevMediaDurationSecRef: React.MutableRefObject<number>;
  prevTimelineWidthPxRef: React.MutableRefObject<number>;
  prevViewportWidthPxRef: React.MutableRefObject<number>;
  programmaticWrites: ProgrammaticWrites;
  applyScrollLeftPx: (
    px: number,
    source: "tier" | "program",
    options?: { timelineWidthPx?: number; deferLayoutCommit?: boolean; immediate?: boolean },
  ) => void;
};

export function useTierScrollResizeEffect(args: TierScrollResizeEffectArgs): void {
  const argsRef = useRef(args);
  argsRef.current = args;

  useLayoutEffect(() => {
    const a = argsRef.current;
    const tier = a.tierScrollRef.current;
    if (!tier || !a.waveformReady) return;

    const isMediaUrlChange = a.prevMediaUrlRef.current !== a.mediaUrl;
    const prevDur = a.prevMediaDurationSecRef.current;
    const dur = a.mediaDurationSec;
    const durationExpanded =
      prevDur > 0 &&
      dur > prevDur + 0.5 &&
      Math.abs(dur - prevDur) / Math.max(prevDur, 1) > 0.02;

    const prevTw = a.prevTimelineWidthPxRef.current;
    const newTw = a.timelineWidthPx;
    a.prevMediaUrlRef.current = a.mediaUrl;
    a.prevMediaDurationSecRef.current = dur;
    a.prevTimelineWidthPxRef.current = newTw;

    const vw = tier.clientWidth;
    if (
      shouldSkipMediaResetForFileViewRestore(
        peekFileViewRestoreForFile(a.fileId ?? null),
        a.fileId ?? null,
      )
    ) {
      a.prevViewportWidthPxRef.current = vw;
      return;
    }

    const shouldResetScroll = isMediaUrlChange || durationExpanded;
    if (shouldResetScroll) {
      a.committedScrollLeftRef.current = 0;
      a.applyScrollLeftPx(0, "program", { immediate: true });
      return;
    }

    const prevVw = a.prevViewportWidthPxRef.current;
    a.prevViewportWidthPxRef.current = vw;
    const liveSl = tier.scrollLeft;

    const timelineChanged = prevTw > 0 && newTw > 0 && Math.abs(prevTw - newTw) > 0.5;
    const viewportChanged = prevVw > 0 && vw > 0 && Math.abs(prevVw - vw) > 1;

    const targetSl = (() => {
      if (timelineChanged && dur > 0 && vw > 0) {
        const maxSl = Math.max(0, newTw - vw);
        if (
          a.programmaticWrites.hasPendingProgrammaticScroll() ||
          a.programmaticWrites.isRecentProgrammaticScroll()
        ) {
          return Math.min(maxSl, Math.max(0, liveSl));
        }
        const effectivePrevVw = prevVw > 0 ? prevVw : vw;
        const centerPx = liveSl + effectivePrevVw / 2;
        const centerTimeSec = (centerPx / Math.max(prevTw, 1)) * dur;
        return scrollPxCenterTimeInViewport({
          timeSec: centerTimeSec,
          timelineWidthPx: newTw,
          durationSec: dur,
          viewportWidthPx: vw,
        });
      }
      if (viewportChanged && dur > 0 && vw > 0) {
        const effectivePrevVw = prevVw > 0 ? prevVw : vw;
        const centerPx = liveSl + effectivePrevVw / 2;
        const centerTimeSec = (centerPx / Math.max(newTw, 1)) * dur;
        return scrollPxCenterTimeInViewport({
          timeSec: centerTimeSec,
          timelineWidthPx: newTw,
          durationSec: dur,
          viewportWidthPx: vw,
        });
      }
      const maxSl = Math.max(0, newTw - vw);
      return Math.min(maxSl, Math.max(0, a.committedScrollLeftRef.current));
    })();

    a.applyScrollLeftPx(targetSl, "program", { immediate: true });
  }, [
    args.applyScrollLeftPx,
    args.fileId,
    args.mediaUrl,
    args.timelineWidthPx,
    args.waveformReady,
    args.mediaDurationSec,
    args.pxPerSec,
    args.programmaticWrites,
    args.clientWidthPx,
  ]);
}
