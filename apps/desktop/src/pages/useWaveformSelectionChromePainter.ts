import { useCallback, type RefObject } from "react";
import { publishSelectionChromeForInput } from "../services/selection/publishSelectionChromeForInput";
import { resolveSelectionChromePreview } from "../services/selection/resolveSelectionChromePreview";
import { isSelectionLatencyProfileEnabled } from "../services/ui/selectionLatencyProfile";
import type { SegmentSelectSource } from "../utils/waveformViewMode";
import type { useWaveformTimelineController } from "../hooks/useWaveformTimelineController";
import type { TranscriptionLayerInput } from "./transcriptionLayerTypes";

type TimelineApi = ReturnType<typeof useWaveformTimelineController>;

export function useWaveformSelectionChromePainter(args: {
  timelineRef: RefObject<{ timeline: TimelineApi }>;
  segmentListRef: RefObject<HTMLDivElement | null>;
}) {
  return useCallback(
    (
      c: TranscriptionLayerInput,
      idx: number,
      opts: { shiftKey?: boolean; toggle?: boolean } | undefined,
      source: SegmentSelectSource,
      publishOpts?: { skipBandPaint?: boolean },
    ) => {
      const preview = resolveSelectionChromePreview(c, idx, opts);
      const tier = args.timelineRef.current.timeline.tierScrollRef.current;
      publishSelectionChromeForInput(
        c,
        { primaryIdx: preview.primaryIdx, selectedSet: preview.selectedSet },
        {
          listRoot: args.segmentListRef.current,
          overlayRoot: tier?.querySelector(".waveform-timeline-overlay-layer") ?? null,
        },
        {
          markFirstPaint: isSelectionLatencyProfileEnabled(),
          skipBandPaint:
            publishOpts?.skipBandPaint === true ||
            source === "list" ||
            source === "listAdvance",
        },
      );
    },
    [args.segmentListRef, args.timelineRef],
  );
}
