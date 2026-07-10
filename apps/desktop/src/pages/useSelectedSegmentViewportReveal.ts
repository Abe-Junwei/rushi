import { useCallback, type RefObject } from "react";
import { effectiveTranscriptPrimaryIdx } from "../components/editor/core/projectionWaveformBridge";
import type { useWaveformTimelineController } from "../hooks/useWaveformTimelineController";
import type { TranscriptionLayerInput } from "./transcriptionLayerTypes";

type TimelineApi = ReturnType<typeof useWaveformTimelineController>;

export function useSelectedSegmentViewportReveal(args: {
  ctxRef: RefObject<TranscriptionLayerInput>;
  timelineRef: RefObject<{ timeline: TimelineApi }>;
}) {
  return useCallback(() => {
    const c = args.ctxRef.current;
    const idx = effectiveTranscriptPrimaryIdx(c.selectedIdx);
    const seg = c.segments[idx];
    if (!seg) return;
    args.timelineRef.current.timeline.viewportFit.revealSegmentInViewport({
      start_sec: seg.start_sec,
      end_sec: seg.end_sec,
    });
  }, [args.ctxRef, args.timelineRef]);
}
