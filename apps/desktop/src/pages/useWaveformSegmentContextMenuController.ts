import { useCallback, type RefObject } from "react";
import { resolveWaveformSegmentContextMenuIndex } from "../utils/waveformSegmentContextMenu";
import { applyContextMenuSelectionBeforeOpen } from "../services/selection/segmentContextMenuSelection";
import type { SegmentSelectSource } from "../utils/waveformViewMode";
import type { useWaveformTimelineController } from "../hooks/useWaveformTimelineController";
import type { TranscriptionLayerInput } from "./transcriptionLayerTypes";

type TimelineApi = ReturnType<typeof useWaveformTimelineController>;

export function useWaveformSegmentContextMenuController(args: {
  ctxRef: RefObject<TranscriptionLayerInput>;
  timeline: TimelineApi;
  laneByIndex: number[];
  laneCount: number;
  selectSegmentAt: (idx: number, source?: SegmentSelectSource) => void;
}) {
  return useCallback(
    (input: {
      clientX: number;
      clientY: number;
      overlayClientTop: number;
      peaksPaintedHeightPx: number;
      layoutYScale: number;
    }) => {
      const c = args.ctxRef.current;
      if (c.busy || !c.onOpenSegmentContextMenu) return;
      const pointerTimeSec = args.timeline.wfApiRef.current.clientXToTimeSec(input.clientX);
      const segmentIdx = resolveWaveformSegmentContextMenuIndex({
        segments: c.segments,
        timeSec: pointerTimeSec,
        pointerClientY: input.clientY,
        overlayClientTop: input.overlayClientTop,
        layoutHeightPx: input.peaksPaintedHeightPx,
        layoutYScale: input.layoutYScale,
        laneByIndex: args.laneByIndex,
        laneCount: args.laneCount,
        selectedIdx: c.selectedIdx,
        durationSec: args.timeline.timelineMetrics.mediaDurationSec,
      });
      if (segmentIdx < 0) return;
      applyContextMenuSelectionBeforeOpen(
        {
          x: input.clientX,
          y: input.clientY,
          segmentIdx,
          pointerTimeSec,
          origin: "waveform",
          selectionText: "",
        },
        c,
        (idx, source) => args.selectSegmentAt(idx, source),
      );
      c.onOpenSegmentContextMenu({
        x: input.clientX,
        y: input.clientY,
        segmentIdx,
        pointerTimeSec,
        origin: "waveform",
        selectionText: "",
      });
    },
    [args],
  );
}
