import { useCallback, type RefObject } from "react";
import { getSelectionChromeSnapshot } from "../services/selection/selectionChromeStore";
import type { useWaveformTimelineController } from "../hooks/useWaveformTimelineController";
import type { TranscriptionLayerInput } from "./transcriptionLayerTypes";

type TimelineApi = ReturnType<typeof useWaveformTimelineController>;

export function useSelectedSegmentViewportReveal(args: {
  ctxRef: RefObject<TranscriptionLayerInput>;
  timelineRef: RefObject<{ timeline: TimelineApi }>;
}) {
  return useCallback(() => {
    const c = args.ctxRef.current;
    const chromePrimary = getSelectionChromeSnapshot().primaryIdx;
    const idx = chromePrimary >= 0 && chromePrimary < c.segments.length ? chromePrimary : c.selectedIdx;
    const seg = c.segments[idx];
    if (!seg) return;
    args.timelineRef.current.timeline.viewportFit.revealSegmentInViewport({
      start_sec: seg.start_sec,
      end_sec: seg.end_sec,
    });
  }, [args.ctxRef, args.timelineRef]);
}
