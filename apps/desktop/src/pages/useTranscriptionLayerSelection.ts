import { useCallback, useMemo, useRef, type RefObject } from "react";
import { p1LaneBoundsSignature } from "../utils/boundsSignature";
import { resolveWaveformSegmentContextMenuIndex } from "../utils/waveformSegmentContextMenu";
import {
  PX_PER_SEC_MAX,
  PX_PER_SEC_MIN,
  resolveWaveformZoomSliderRange,
} from "../utils/pxPerSec";
import { computeZoomInPxPerSec, computeZoomOutPxPerSec } from "../utils/waveformZoomSlider";
import { assignSegmentOverlapLanes } from "../utils/segmentLayout";
import { resolveSelectSegmentViewportPlan } from "../services/waveform/selectSegmentViewportPlan";
import { segmentStartSec } from "../utils/formatMediaTime";
import type { SegmentSelectSource } from "../utils/waveformViewMode";
import {
  shouldFocusWaveformShellForSelectSource,
  shouldFitSelectionOnWaveformSelect,
  shouldZoomViewportOnSelectSource,
} from "../utils/waveformViewMode";
import type { useWaveformTimelineController } from "../hooks/useWaveformTimelineController";
import type { TranscriptionLayerInput } from "./transcriptionLayerTypes";

type TimelineApi = ReturnType<typeof useWaveformTimelineController>;

export function useTranscriptionLayerSelection(opts: {
  ctx: TranscriptionLayerInput;
  ctxRef: RefObject<TranscriptionLayerInput>;
  timeline: TimelineApi;
  waveformShellRef: RefObject<HTMLElement | null>;
  setSelectedIdxUi: (idx: number, opts?: { shiftKey?: boolean; toggle?: boolean }) => void;
}) {
  const { ctx, ctxRef, timeline, waveformShellRef, setSelectedIdxUi } = opts;

  const scrollFitRef = useRef({ timeline });
  scrollFitRef.current = { timeline };

  const stepWaveformZoomRef = useRef<(direction: "in" | "out") => void>(() => {});
  stepWaveformZoomRef.current = (direction) => {
    const { timeline: tl } = scrollFitRef.current;
    const tier = tl.tierScrollRef.current;
    const dur = tl.timelineMetrics.mediaDurationSec;
    const vw = tier?.clientWidth ?? 0;
    const px = tl.pxPerSec;
    const sliderRange =
      vw > 0 && dur >= 0.5
        ? resolveWaveformZoomSliderRange(vw, dur)
        : { minPxPerSec: PX_PER_SEC_MIN, maxPxPerSec: PX_PER_SEC_MAX };
    const next =
      direction === "in"
        ? computeZoomInPxPerSec(px, sliderRange)
        : computeZoomOutPxPerSec(px, sliderRange);
    if (Math.abs(next - px) < 0.001) return;
    tl.zoom.setPxPerSecFromSlider(next);
  };

  const selectSegmentAtRef = useRef<
    (idx: number, source?: SegmentSelectSource, opts?: { shiftKey?: boolean; toggle?: boolean }) => void
  >(() => {});

  const laneBoundsSig = p1LaneBoundsSignature(ctx.segments);
  const segmentLaneLayout = useMemo(() => {
    void laneBoundsSig;
    return assignSegmentOverlapLanes(
      ctxRef.current.segments,
      timeline.timelineMetrics.mediaDurationSec,
    );
  }, [ctxRef, laneBoundsSig, timeline.timelineMetrics.mediaDurationSec]);

  const focusWaveformShell = useCallback(() => {
    waveformShellRef.current?.focus();
  }, [waveformShellRef]);

  const revealSelectedSegmentInViewport = useCallback(() => {
    const c = ctxRef.current;
    const seg = c.segments[c.selectedIdx];
    if (!seg) return;
    scrollFitRef.current.timeline.viewportFit.revealSegmentInViewport({
      start_sec: seg.start_sec,
      end_sec: seg.end_sec,
    });
  }, [ctxRef]);

  const selectSegmentAt = useCallback(
    (idx: number, source: SegmentSelectSource = "waveform", opts?: { shiftKey?: boolean; toggle?: boolean }) => {
      const c = ctxRef.current;
      if (c.busy) return;
      const s = c.segments[idx];
      if (!s) return;
      setSelectedIdxUi(idx, opts);
      const plan = resolveSelectSegmentViewportPlan(s);
      const seg = plan.segment;
      if (shouldZoomViewportOnSelectSource(source)) {
        scrollFitRef.current.timeline.viewportFit.zoomToFitSegment({
          start_sec: seg.start_sec,
          end_sec: seg.end_sec,
        });
      } else if (
        shouldFitSelectionOnWaveformSelect(
          source,
          scrollFitRef.current.timeline.zoom.layoutIntentRef.current,
        )
      ) {
        scrollFitRef.current.timeline.viewportFit.zoomToFitSegment(
          { start_sec: seg.start_sec, end_sec: seg.end_sec },
          { forceFullFit: true },
        );
      } else {
        scrollFitRef.current.timeline.viewportFit.revealSegmentInViewport({
          start_sec: seg.start_sec,
          end_sec: seg.end_sec,
        });
      }
      if (source !== "listAdvance") {
        requestAnimationFrame(() => {
          timeline.wfApiRef.current.seek(segmentStartSec(s));
        });
      }
      if (shouldFocusWaveformShellForSelectSource(source)) {
        focusWaveformShell();
      }
    },
    [ctxRef, focusWaveformShell, setSelectedIdxUi, timeline.wfApiRef],
  );

  selectSegmentAtRef.current = selectSegmentAt;

  const openSegmentContextMenuFromPointer = useCallback(
    (input: {
      clientX: number;
      clientY: number;
      overlayClientTop: number;
      peaksPaintedHeightPx: number;
      layoutYScale: number;
    }) => {
      const c = ctxRef.current;
      if (c.busy || !c.onOpenSegmentContextMenu) return;
      const pointerTimeSec = timeline.wfApiRef.current.clientXToTimeSec(input.clientX);
      const segmentIdx = resolveWaveformSegmentContextMenuIndex({
        segments: c.segments,
        timeSec: pointerTimeSec,
        pointerClientY: input.clientY,
        overlayClientTop: input.overlayClientTop,
        layoutHeightPx: input.peaksPaintedHeightPx,
        layoutYScale: input.layoutYScale,
        laneByIndex: segmentLaneLayout.laneByIndex,
        laneCount: segmentLaneLayout.laneCount,
        selectedIdx: c.selectedIdx,
        durationSec: timeline.timelineMetrics.mediaDurationSec,
      });
      if (segmentIdx < 0) return;
      c.onOpenSegmentContextMenu({
        x: input.clientX,
        y: input.clientY,
        segmentIdx,
        pointerTimeSec,
        origin: "waveform",
        selectionText: "",
      });
    },
    [ctxRef, segmentLaneLayout.laneByIndex, segmentLaneLayout.laneCount, timeline.timelineMetrics.mediaDurationSec, timeline.wfApiRef],
  );

  return {
    segmentLaneLayout,
    focusWaveformShell,
    revealSelectedSegmentInViewport,
    selectSegmentAt,
    selectSegmentAtRef,
    stepWaveformZoomRef,
    openSegmentContextMenuFromPointer,
  };
}
