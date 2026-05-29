import { useCallback, useMemo, useRef, useState } from "react";
import { useSegmentKeyboard } from "../hooks/useSegmentKeyboard";
import { useWaveformTimelineController } from "../hooks/useWaveformTimelineController";
import { useWaveformEditorPrefs } from "../hooks/useWaveformEditorPrefs";
import { p1LaneBoundsSignature } from "../utils/boundsSignature";
import {
  PX_PER_SEC_MAX,
  PX_PER_SEC_MIN,
  resolveWaveformZoomSliderRange,
} from "../utils/pxPerSec";
import { computeZoomInPxPerSec, computeZoomOutPxPerSec } from "../utils/waveformZoomSlider";
import { assignSegmentOverlapLanes, computeSegmentLaneRowPx } from "../utils/segmentLayout";
import { resolveSelectSegmentViewportPlan } from "../services/waveform/selectSegmentViewportPlan";
import { parseMediaTimeInput, segmentStartSec } from "../utils/formatMediaTime";
import type { SegmentSelectSource } from "../utils/waveformViewMode";
import { shouldFocusWaveformShellForSelectSource } from "../utils/waveformViewMode";
export { TIMELINE_PX_PER_SEC, clampPxPerSec } from "../utils/pxPerSec";
export { computeSegmentLaneRowPx, assignSegmentOverlapLanes, computeTimelineWidthPx, SEGMENT_LANE_ROW_PX } from "../utils/segmentLayout";

export type TranscriptionLayerApi = ReturnType<typeof useTranscriptionLayer>;

import type { TranscriptionLayerInput } from "./transcriptionLayerTypes";

export type { TranscriptionLayerInput } from "./transcriptionLayerTypes";

export function useTranscriptionLayer(ctx: TranscriptionLayerInput) {
  const segmentListRef = useRef<HTMLDivElement | null>(null);
  const waveformShellRef = useRef<HTMLDivElement | null>(null);
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  const editorPrefs = useWaveformEditorPrefs(ctx.mediaUrl);

  const timeline = useWaveformTimelineController(ctx);

  const setSelectedIdxUi = useCallback((idx: number) => {
    ctxRef.current.setSelectedIdx(idx);
  }, []);

  const [editorHint, setEditorHint] = useState("");
  const editorHintTimerRef = useRef(0);
  const showEditorHint = useCallback((msg: string) => {
    window.clearTimeout(editorHintTimerRef.current);
    setEditorHint(msg);
    editorHintTimerRef.current = window.setTimeout(() => {
      setEditorHint((prev) => (prev === msg ? "" : prev));
    }, 2400);
  }, []);
  const showEditorHintRef = useRef(showEditorHint);
  showEditorHintRef.current = showEditorHint;

  const scrollFitRef = useRef({ timeline });
  scrollFitRef.current = { timeline };

  const stepWaveformZoomRef = useRef<(direction: "in" | "out") => void>(() => {});
  stepWaveformZoomRef.current = (direction) => {
    const { timeline: tl } = scrollFitRef.current;
    const tier = tl.tierScrollRef.current;
    const dur = tl.wfApiRef.current.duration || tl.durationRef.current || 0;
    const vw = tier?.clientWidth ?? 0;
    const px = tl.layoutPxPerSec;
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

  const selectSegmentAtRef = useRef<(idx: number, source?: SegmentSelectSource) => void>(() => {});

  const keyboard = useSegmentKeyboard({
    ctxRef,
    wfApiRef: timeline.wfApiRef,
    selectSegmentAtRef,
    tierScrollRef: timeline.tierScrollRef,
    showEditorHintRef,
    stepWaveformZoomRef,
  });

  const segmentLaneRowPx = useMemo(
    () => computeSegmentLaneRowPx(timeline.display.transcriptFontPx),
    [timeline.display.transcriptFontPx],
  );

  const laneBoundsSig = p1LaneBoundsSignature(ctx.segments);
  const segmentLaneLayout = useMemo(() => {
    void laneBoundsSig;
    return assignSegmentOverlapLanes(ctxRef.current.segments);
  }, [laneBoundsSig]);

  const focusWaveformShell = useCallback(() => {
    waveformShellRef.current?.focus();
  }, []);

  const selectSegmentAt = useCallback(
    (idx: number, source: SegmentSelectSource = "waveform") => {
      const c = ctxRef.current;
      const s = c.segments[idx];
      if (!s) return;
      setSelectedIdxUi(idx);
      const plan = resolveSelectSegmentViewportPlan(s);
      scrollFitRef.current.timeline.viewportFit.zoomToFitSegment({
        start_sec: plan.segment.start_sec,
        end_sec: plan.segment.end_sec,
      });
      requestAnimationFrame(() => {
        timeline.wfApiRef.current.seek(segmentStartSec(s));
      });
      if (shouldFocusWaveformShellForSelectSource(source)) {
        focusWaveformShell();
      }
    },
    [focusWaveformShell, setSelectedIdxUi, timeline.wfApiRef],
  );

  selectSegmentAtRef.current = selectSegmentAt;

  const jumpToMediaTime = useCallback(
    (raw: string) => {
      const dur = timeline.wfApiRef.current.duration || timeline.durationRef.current || 0;
      const sec = parseMediaTimeInput(raw, dur > 0 ? dur : undefined);
      if (sec == null) {
        showEditorHintRef.current("时间格式无效，请用 m:ss 或 h:mm:ss。");
        return false;
      }
      timeline.wfApiRef.current.seek(sec);
      return true;
    },
    [timeline.durationRef, timeline.wfApiRef],
  );

  const { wf, display, peaks, zoom } = timeline;
  const waveformStageHeightPx = display.waveformHeightPx;

  return {
    tierScrollRef: timeline.tierScrollRef,
    segmentListRef,
    waveformShellRef,
    globalStripCollapsed: editorPrefs.globalStripCollapsed,
    toggleGlobalStripCollapsed: editorPrefs.toggleGlobalStripCollapsed,
    editorHint,
    waveformStageHeightPx,
    tierScrollLayout: timeline.tierScrollLayout,
    seekFromTierClientX: timeline.seekFromTierClientX,
    setTierScrollPx: timeline.setTierScrollPx,
    segmentLaneLayout,
    segmentLaneRowPx,
    waveformHeightPx: display.waveformHeightPx,
    waveformRenderHeightPx: display.waveformRenderHeightPx,
    waveformPaintedHeightPx: display.waveformPaintedHeightPx,
    waveformHeightDragging: display.waveformHeightDragging,
    transcriptFontPx: display.transcriptFontPx,
    transcriptRowHeightPx: display.transcriptRowHeightPx,
    nudgeWaveformHeight: display.nudgeWaveformHeight,
    nudgeTranscriptFontPx: display.nudgeTranscriptFontPx,
    nudgeTranscriptRowHeightPx: display.nudgeTranscriptRowHeightPx,
    beginWaveformHeightDrag: display.beginWaveformHeightDrag,
    beginTranscriptFontDrag: display.beginTranscriptFontDrag,
    beginTranscriptRowHeightDrag: display.beginTranscriptRowHeightDrag,
    onTierScroll: timeline.onTierScroll,
    timelineWidthPx: timeline.timelineWidthPx,
    drawTimelineWidthPx: timeline.drawTimelineWidthPx,
    renderTimelineWidthPx: timeline.timelineWidthPx,
    peaksLoading: peaks.loading,
    peaksError: peaks.error,
    peakCache: peaks.peakCache,
    layoutPxPerSec: timeline.layoutPxPerSec,
    drawPxPerSec: timeline.drawPxPerSec,
    pxPerSec: timeline.layoutPxPerSec,
    committedPxPerSec: timeline.drawPxPerSec,
    renderPxPerSec: zoom.renderPxPerSec,
    zoomPreviewActive: zoom.zoomPreviewActive,
    zoomDragging: zoom.zoomDragging,
    resetZoom: zoom.resetZoom,
    resetZoomForMedia: zoom.resetZoomForMedia,
    stepWaveformZoom: (direction: "in" | "out") => stepWaveformZoomRef.current(direction),
    zoomToFitSelection: timeline.viewportFit.zoomToFitSelection,
    setPxPerSecFromSlider: zoom.setPxPerSecFromSlider,
    beginZoomInteraction: zoom.beginZoomInteraction,
    commitZoomInteraction: zoom.commitZoomInteraction,
    selectSegmentAt,
    selectSegmentFromList: (idx: number) => selectSegmentAt(idx, "list"),
    jumpToMediaTime,
    insertSegmentAfter: ctx.insertSegmentAfter,
    deleteSegmentAt: ctx.deleteSegmentAt,
    splitAtPlayhead: ctx.splitAtPlayhead,
    focusWaveformShell,
    onWaveformMainKeyDown: keyboard.onWaveformMainKeyDown,
    onSegmentTextareaKeyDown: keyboard.onSegmentTextareaKeyDown,
    ...wf,
  };
}
