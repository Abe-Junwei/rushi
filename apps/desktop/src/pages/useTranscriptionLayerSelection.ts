import { useCallback, useMemo, useRef, type MutableRefObject, type RefObject } from "react";
import { p1LaneBoundsSignature } from "../utils/boundsSignature";
import { assignSegmentOverlapLanes } from "../utils/segmentLayout";
import type { SegmentSelectAtOptions, SegmentSelectSource } from "../utils/waveformViewMode";
import type { useWaveformTimelineController } from "../hooks/useWaveformTimelineController";
import { useListKeyboardBurstSelection } from "../hooks/useListKeyboardBurstSelection";
import type { SegmentListFilterNavState } from "../utils/segmentListFilterNav";
import type { TranscriptionLayerInput } from "./transcriptionLayerTypes";
import { useWaveformSelectionGestureDispatcher } from "./useWaveformSelectionGestureDispatcher";
import { useWaveformSegmentContextMenuController } from "./useWaveformSegmentContextMenuController";
import { useWaveformZoomStepController } from "./useWaveformZoomStepController";
import { useSelectedSegmentViewportReveal } from "./useSelectedSegmentViewportReveal";
import { selectSegmentTransport } from "./selectSegmentTransport";

type TimelineApi = ReturnType<typeof useWaveformTimelineController>;

export function useTranscriptionLayerSelection(opts: {
  ctx: TranscriptionLayerInput;
  ctxRef: RefObject<TranscriptionLayerInput>;
  timeline: TimelineApi;
  waveformShellRef: RefObject<HTMLElement | null>;
  segmentListRef: RefObject<HTMLDivElement | null>;
  selectedIdxRef?: MutableRefObject<number>;
  segmentListFilterNavRef?: MutableRefObject<SegmentListFilterNavState>;
  transcriptRowHeightPx?: number;
  /** @deprecated listKeyboard now seeks (industry); divert unused. Kept for call-site stability. */
  onListLikeSegmentSelect?: (idx: number) => void;
  /** List listen-jump: tear segment bound for global, or open segment play when sticky segment session. */
  beginGlobalPlayback?: (idx?: number) => void;
}) {
  const {
    ctx,
    ctxRef,
    timeline,
    waveformShellRef,
    segmentListRef,
    selectedIdxRef,
    segmentListFilterNavRef,
    transcriptRowHeightPx = 70,
    beginGlobalPlayback,
  } = opts;

  const scrollFitRef = useRef({ timeline });
  scrollFitRef.current = { timeline };

  const stepWaveformZoomRef = useWaveformZoomStepController(scrollFitRef);

  const selectSegmentAtRef =
    useRef<(idx: number, source?: SegmentSelectSource, opts?: SegmentSelectAtOptions) => void>(() => {});

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

  const paintSelectionChrome = useCallback(
    (
      _c: TranscriptionLayerInput,
      _idx: number,
      _opts: { shiftKey?: boolean; toggle?: boolean } | undefined,
      _source: SegmentSelectSource,
      _publishOpts?: { skipBandPaint?: boolean },
    ) => {
      // P9b2: SC2 publish removed; band/overlay read transcriptProjection.
    },
    [],
  );

  const commitWaveformSelectPreviewSc1 = useCallback(
    (idx: number) => {
      if (selectedIdxRef) selectedIdxRef.current = idx;
      if (ctxRef.current.selectedIdxRef) ctxRef.current.selectedIdxRef.current = idx;
    },
    [ctxRef, selectedIdxRef],
  );

  const revealSelectedSegmentInViewport = useSelectedSegmentViewportReveal({
    ctxRef,
    timelineRef: scrollFitRef,
  });

  const beginGlobalPlaybackRef = useRef(beginGlobalPlayback);
  beginGlobalPlaybackRef.current = beginGlobalPlayback;

  const burst = useListKeyboardBurstSelection({
    ctxRef,
    scrollFitRef,
    segmentListRef,
    segmentListFilterNavRef,
    waveformShellRef,
    transcriptRowHeightPx,
    lastSegmentSelectSourceRef,
    beginGlobalPlayback: (idx?: number) => beginGlobalPlaybackRef.current?.(idx),
  });

  const selectSegmentAt = useCallback(
    (idx: number, source: SegmentSelectSource = "waveform", opts?: SegmentSelectAtOptions) => {
      // List + keyboard listen-jump seek — do not divert follow (playhead aligns).
      selectSegmentTransport(idx, source, opts, {
        ctxRef,
        scrollFitRef,
        segmentListRef,
        selectedIdxRef,
        lastSegmentSelectSourceRef,
        scheduleRevealSelectedSegment: burst.scheduleRevealSelectedSegment,
        cancelPendingSelectionReveal: burst.cancelPendingSelectionReveal,
        focusWaveformShell,
        beginGlobalPlayback: (seekIdx?: number) => beginGlobalPlaybackRef.current?.(seekIdx),
      });
    },
    [
      burst.cancelPendingSelectionReveal,
      burst.scheduleRevealSelectedSegment,
      ctxRef,
      focusWaveformShell,
      segmentListRef,
      selectedIdxRef,
    ],
  );

  selectSegmentAtRef.current = selectSegmentAt;

  const { dispatchWaveformSelectionGesture, previewWaveformSegmentChrome } =
    useWaveformSelectionGestureDispatcher({
      ctxRef,
      timelineRef: scrollFitRef,
      paintSelectionChrome,
      commitWaveformSelectPreviewSc1,
      runWaveformSelectListScroll: burst.runWaveformSelectListScroll,
      lastSegmentSelectSourceRef,
      selectSegmentAt,
      focusWaveformShell,
    });

  const openSegmentContextMenuFromPointer = useWaveformSegmentContextMenuController({
    ctxRef,
    timeline,
    laneByIndex: segmentLaneLayout.laneByIndex,
    laneCount: segmentLaneLayout.laneCount,
    selectSegmentAt,
  });

  return {
    segmentLaneLayout,
    focusWaveformShell,
    revealSelectedSegmentInViewport,
    cancelPendingSelectionReveal: burst.cancelPendingSelectionReveal,
    finalizeListKeyboardViewport: burst.finalizeListKeyboardViewport,
    commitListKeyboardBurst: burst.commitListKeyboardBurst,
    selectSegmentAt,
    selectSegmentAtRef,
    dispatchWaveformSelectionGesture,
    previewWaveformSegmentChrome,
    lastSegmentSelectSourceRef,
    stepWaveformZoomRef,
    openSegmentContextMenuFromPointer,
  };
}
