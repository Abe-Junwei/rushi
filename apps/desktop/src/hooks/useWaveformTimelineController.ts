import { useEffect, useMemo, useRef, useState } from "react";
import { useProjectWaveform } from "./useProjectWaveform";
import type { useProjectWaveform as UseProjectWaveformHook } from "./useProjectWaveform";
import { useTierScrollSync } from "./useTierScrollSync";
import { useWaveformPlaybackScrollFollow } from "./useWaveformPlaybackScrollFollow";
import { useWaveformDisplay } from "./useWaveformDisplay";
import { useWaveformPeaks } from "./useWaveformPeaks";
import { useWaveformZoom } from "./useWaveformZoom";
import { resolveWaveformTimelineMode } from "../services/waveform/waveformTimelineTypes";
import { computeTimelineWidthPx } from "../utils/segmentLayout";
import { useTranscriptionViewportFit } from "../pages/useTranscriptionViewportFit";
import { writeStoredWaveformPxPerSecDefault } from "../utils/waveformPrefs";
import type { TranscriptionLayerInput } from "../pages/transcriptionLayerTypes";

type WfApi = ReturnType<typeof UseProjectWaveformHook>;

/** Waveform timeline: zoom, scroll, peaks, viewport fit (ADR-0005 S2). */
export function useWaveformTimelineController(ctx: TranscriptionLayerInput) {
  const tierScrollRef = useRef<HTMLDivElement | null>(null);
  const durationRef = useRef(0);
  const syncWaveformScrollRef = useRef<(scrollLeftPx: number) => void>(() => {});
  const scrollApiRef = useRef({ setTierScrollPx: (_scrollLeftPx: number) => {} });
  const wfApiRef = useRef<WfApi>(null!);
  const onWaveformScrollRef = useRef<(scrollLeftPx: number) => void>(() => {});
  const suppressWaveformScrollUntilRef = useRef(0);
  const applyPendingViewportFitRef = useRef<(pxPerSec: number, options?: { finalize?: boolean }) => boolean>(
    () => false,
  );

  const display = useWaveformDisplay({ busy: ctx.busy });
  const zoom = useWaveformZoom();
  const [resolvedDurationSec, setResolvedDurationSec] = useState(0);
  const peaks = useWaveformPeaks(
    ctx.projectId,
    ctx.mediaUrl ? ctx.fileId : null,
    resolvedDurationSec,
  );

  const wf = useProjectWaveform({
    mediaUrl: ctx.mediaUrl,
    segments: ctx.segments,
    selectedIdx: ctx.selectedIdx,
    disabled: ctx.busy,
    minPxPerSec: zoom.drawPxPerSec,
    interactionPxPerSec: zoom.layoutPxPerSec,
    peakCache: peaks.peakCache,
    zoomDragging: zoom.zoomDragging,
    waveformHeightPx: display.waveformRenderHeightPx,
    onWaveformHeightApplied: display.markWaveformRenderHeightApplied,
    onWaveformCreateRange: ctx.insertSegmentFromTimeRange,
    onWaveformScroll: (scrollLeftPx) => onWaveformScrollRef.current(scrollLeftPx),
    getViewportScrollPx: () => tierScrollRef.current?.scrollLeft ?? 0,
    onZoomApplied: (pxPerSec) => applyPendingViewportFitRef.current(pxPerSec, { finalize: true }),
  });

  durationRef.current = wf.duration || 0;
  wfApiRef.current = wf;

  useEffect(() => {
    setResolvedDurationSec(0);
  }, [ctx.projectId, ctx.fileId, ctx.mediaUrl]);

  useEffect(() => {
    const d = wf.duration || peaks.status?.durationSec || 0;
    if (d > 0) {
      setResolvedDurationSec((prev) => (Math.abs(prev - d) < 1e-6 ? prev : d));
    }
  }, [wf.duration, peaks.status?.durationSec]);

  const layoutPxPerSec = zoom.layoutPxPerSec;
  const drawPxPerSec = zoom.drawPxPerSec;
  const layoutPxPerSecRef = useRef(layoutPxPerSec);
  layoutPxPerSecRef.current = layoutPxPerSec;

  const timelineWidthPx = useMemo(
    () => computeTimelineWidthPx(resolvedDurationSec, layoutPxPerSec),
    [resolvedDurationSec, layoutPxPerSec],
  );

  const drawTimelineWidthPx = useMemo(
    () => computeTimelineWidthPx(resolvedDurationSec, drawPxPerSec),
    [resolvedDurationSec, drawPxPerSec],
  );

  const peaksCanvasActive = resolveWaveformTimelineMode(peaks.peakCache) === "peaks";

  const scroll = useTierScrollSync({
    tierScrollRef,
    timelineWidthPx,
    wfApiRef,
    waveformReady: wf.isReady,
    mediaUrl: ctx.mediaUrl,
    peaksCanvasActive,
  });

  useWaveformPlaybackScrollFollow({
    tierScrollRef,
    timelineWidthPx,
    durationSec: wf.duration || durationRef.current || 0,
    isPlaying: wf.isPlaying,
    isReady: wf.isReady,
    enabled: peaksCanvasActive,
    getPlayheadTimeSec: wf.getPlayheadTime,
    setTierScrollPx: scroll.setTierScrollPx,
  });

  syncWaveformScrollRef.current = scroll.syncWaveformScrollPx;
  scrollApiRef.current = scroll;

  const viewportFit = useTranscriptionViewportFit({
    tierScrollRef,
    durationRef,
    syncWaveformScrollRef,
    scrollApiRef,
    wfApiRef,
    zoom,
    currentPxPerSec: layoutPxPerSec,
    currentPxPerSecRef: layoutPxPerSecRef,
    renderTimelineWidthPx: timelineWidthPx,
    drawPxPerSec,
    waveformReady: wf.isReady,
    mediaUrl: ctx.mediaUrl,
    getSelectedSegment: () => ctx.segments[ctx.selectedIdx] ?? null,
    suppressWaveformScrollUntilRef,
    peaksCanvasActive,
  });

  onWaveformScrollRef.current = viewportFit.onWaveformScroll;
  applyPendingViewportFitRef.current = viewportFit.applyPendingViewportFit;

  const prevMediaUrlRef = useRef<string | null>(null);
  useEffect(() => {
    if (!ctx.mediaUrl) {
      prevMediaUrlRef.current = null;
      return;
    }
    if (prevMediaUrlRef.current !== null && prevMediaUrlRef.current !== ctx.mediaUrl) {
      zoom.resetZoom();
      writeStoredWaveformPxPerSecDefault();
    }
    prevMediaUrlRef.current = ctx.mediaUrl;
  }, [ctx.mediaUrl, zoom]);

  const markProgrammaticScroll = viewportFit.markProgrammaticScroll;
  const setTierScrollPx = scroll.setTierScrollPx;

  return {
    tierScrollRef,
    display,
    peaks,
    zoom,
    wf,
    wfApiRef,
    durationRef,
    scroll,
    viewportFit,
    resolvedDurationSec,
    timelineWidthPx,
    drawTimelineWidthPx,
    layoutPxPerSec,
    drawPxPerSec,
    peaksCanvasActive,
    tierScrollLayout: scroll.tierScrollLayout,
    onTierScroll: scroll.onTierScroll,
    seekFromTierClientX: scroll.seekFromTierClientX,
    markProgrammaticScroll,
    setTierScrollPx,
  };
}
