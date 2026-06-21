import { useCallback, useMemo, useRef, type RefObject } from "react";
import { flushSync } from "react-dom";
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
import { shouldFocusWaveformShellForSelectSource } from "../utils/waveformViewMode";
import type { useWaveformTimelineController } from "../hooks/useWaveformTimelineController";
import {
  selectionProfileBegin,
  selectionProfileFlush,
  selectionProfileMarkFirstPaint,
  selectionProfileTime,
  isSelectionLatencyProfileEnabled,
} from "../services/ui/selectionLatencyProfile";
import { flushTierScrollFrame } from "../utils/tierScrollFrameCoordinator";
import { isEditorFocusGateOpen } from "../utils/editorFocusGate";
import {
  shouldRevealOnSegmentSelect,
  shouldSeekOnSegmentSelect,
} from "../utils/selectionRevealSeekPolicy";
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

  /** 最近一次语段选中来源（供列表 scroll coalesce 分支）。 */
  const lastSegmentSelectSourceRef = useRef<SegmentSelectSource>("waveform");

  const laneBoundsSig = useMemo(() => p1LaneBoundsSignature(ctx.segments), [ctx.segments]);
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

  const commitSelectedIdxUi = useCallback(
    (idx: number, opts?: { shiftKey?: boolean; toggle?: boolean }, sync = false) => {
      if (!sync) {
        setSelectedIdxUi(idx, opts);
        return;
      }
      // Waveform-origin selection still needs the selected overlay before focus/gesture follow-up.
      flushSync(() => {
        setSelectedIdxUi(idx, opts);
      });
    },
    [setSelectedIdxUi],
  );

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
      const idxChanged = idx !== c.selectedIdx;
      const editorFocusGateOpen = isEditorFocusGateOpen({
        segmentsLength: c.segments.length,
        waveformShell: waveformShellRef.current,
      });
      const shouldReveal = shouldRevealOnSegmentSelect({
        source,
        idxChanged,
        editorFocusGateOpen,
      });
      const shouldSeek = shouldSeekOnSegmentSelect(source) && idxChanged;
      selectionProfileBegin(`${source} idx=${idx} segments=${c.segments.length}`);
      lastSegmentSelectSourceRef.current = source;
      const plan = selectionProfileTime("resolvePlan", () => resolveSelectSegmentViewportPlan(s));
      const seg = plan.segment;
      if (shouldReveal) {
        selectionProfileTime("viewport", () => {
          scrollFitRef.current.timeline.viewportFit.revealSegmentInViewport({
            start_sec: seg.start_sec,
            end_sec: seg.end_sec,
          });
        });
      }
      selectionProfileTime("flushSelectedIdx", () => {
        commitSelectedIdxUi(idx, opts, source === "waveform");
        if (source === "waveform") {
          flushTierScrollFrame();
        }
      });
      if (isSelectionLatencyProfileEnabled()) {
        requestAnimationFrame(() => {
          selectionProfileMarkFirstPaint();
        });
      }
      if (shouldSeek) {
        requestAnimationFrame(() => {
          const tl = scrollFitRef.current.timeline;
          selectionProfileTime("seek", () => {
            tl.suppressPlaybackFollowForSelectionSeek();
            tl.wfApiRef.current.seek(segmentStartSec(s));
          });
          selectionProfileFlush();
        });
      } else {
        requestAnimationFrame(() => selectionProfileFlush());
      }
      if (shouldFocusWaveformShellForSelectSource(source)) {
        selectionProfileTime("focus", focusWaveformShell);
      }
    },
    [commitSelectedIdxUi, ctxRef, focusWaveformShell],
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
    lastSegmentSelectSourceRef,
    stepWaveformZoomRef,
    openSegmentContextMenuFromPointer,
  };
}
