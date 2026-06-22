import { useCallback, useMemo, useRef, type MutableRefObject, type RefObject } from "react";
import { p1LaneBoundsSignature } from "../utils/boundsSignature";
import { assignSegmentOverlapLanes } from "../utils/segmentLayout";
import { resolveSelectSegmentViewportPlan } from "../services/waveform/selectSegmentViewportPlan";
import { syncWaveformSegmentSelectReveal, syncWaveformSegmentSelectSeek } from "../services/waveform/syncWaveformSegmentSelectViewport";
import { clearWaveformSegmentPreviewViewportSync, consumeWaveformSegmentPreviewViewportSync } from "../services/waveform/waveformSegmentSelectPreviewSync";
import type { SegmentSelectAtOptions, SegmentSelectSource } from "../utils/waveformViewMode";
import {
  isListKeyboardBurstStep,
  shouldFocusWaveformShellForSelectSource,
} from "../utils/waveformViewMode";
import type { useWaveformTimelineController } from "../hooks/useWaveformTimelineController";
import {
  selectionProfileBegin,
  selectionProfileScheduleFlush,
  selectionProfileTime,
  isSelectionLatencyProfileEnabled,
} from "../services/ui/selectionLatencyProfile";
import {
  getSelectionChromeSnapshot,
  selectionChromePrimaryOutOfSync,
} from "../services/selection/selectionChromeStore";
import { flushTierScrollFrame } from "../utils/tierScrollFrameCoordinator";
import { isEditorFocusGateOpen } from "../utils/editorFocusGate";
import {
  cancelListKeyboardKeyupReveal,
  clearListKeyboardImperativeScrollKey,
  clearListKeyboardVirtualDisplayPin,
} from "../services/selection/listKeyboardBurstCoordinator";
import { useListKeyboardBurstSelection } from "../hooks/useListKeyboardBurstSelection";
import type { SegmentListFilterNavState } from "../utils/segmentListFilterNav";
import {
  shouldRevealOnSegmentSelect,
  shouldSeekOnSegmentSelect,
} from "../utils/selectionRevealSeekPolicy";
import type { TranscriptionLayerInput } from "./transcriptionLayerTypes";
import { useWaveformSelectionGestureDispatcher } from "./useWaveformSelectionGestureDispatcher";
import { useWaveformSegmentContextMenuController } from "./useWaveformSegmentContextMenuController";
import { useWaveformZoomStepController } from "./useWaveformZoomStepController";
import { useWaveformSelectionChromePainter } from "./useWaveformSelectionChromePainter";
import { useSelectedSegmentViewportReveal } from "./useSelectedSegmentViewportReveal";
import { useSelectedIdxCommitter } from "./useSelectedIdxCommitter";
import { useWaveformKeyboardSelectionCommit } from "./useWaveformKeyboardSelectionCommit";

type TimelineApi = ReturnType<typeof useWaveformTimelineController>;

export function useTranscriptionLayerSelection(opts: {
  ctx: TranscriptionLayerInput;
  ctxRef: RefObject<TranscriptionLayerInput>;
  timeline: TimelineApi;
  waveformShellRef: RefObject<HTMLElement | null>;
  segmentListRef: RefObject<HTMLDivElement | null>;
  setSelectedIdxUi: (idx: number, opts?: SegmentSelectAtOptions) => void;
  selectedIdxRef?: MutableRefObject<number>;
  segmentListFilterNavRef?: MutableRefObject<SegmentListFilterNavState>;
  transcriptRowHeightPx?: number;
}) {
  const {
    ctx,
    ctxRef,
    timeline,
    waveformShellRef,
    segmentListRef,
    setSelectedIdxUi,
    selectedIdxRef,
    segmentListFilterNavRef,
    transcriptRowHeightPx = 70,
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

  const paintSelectionChrome = useWaveformSelectionChromePainter({
    timelineRef: scrollFitRef,
    segmentListRef,
  });
  const commitSelectedIdxUi = useSelectedIdxCommitter(setSelectedIdxUi);
  const waveformKeyboardCommit = useWaveformKeyboardSelectionCommit(setSelectedIdxUi);

  const commitWaveformSelectPreviewSc1 = useCallback((idx: number) => {
    if (selectedIdxRef) selectedIdxRef.current = idx;
  }, [selectedIdxRef]);

  const revealSelectedSegmentInViewport = useSelectedSegmentViewportReveal({ ctxRef, timelineRef: scrollFitRef });

  const burst = useListKeyboardBurstSelection({
    ctxRef,
    scrollFitRef,
    segmentListRef,
    segmentListFilterNavRef,
    waveformShellRef,
    setSelectedIdxUi,
    transcriptRowHeightPx,
    lastSegmentSelectSourceRef,
  });

  const selectSegmentAt = useCallback(
    (idx: number, source: SegmentSelectSource = "waveform", opts?: SegmentSelectAtOptions) => {
      const c = ctxRef.current;
      if (c.busy) return;
      const s = c.segments[idx];
      if (!s) return;
      const isWaveformKeyboard = source === "waveformKeyboard";
      const isWaveformLike = source === "waveform" || isWaveformKeyboard;
      if (!isWaveformKeyboard) waveformKeyboardCommit.cancel();
      if (!isListKeyboardBurstStep(source, opts)) {
        clearListKeyboardImperativeScrollKey();
        clearListKeyboardVirtualDisplayPin();
        cancelListKeyboardKeyupReveal();
      }
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
      if (source !== "waveform" || opts?.shiftKey || opts?.toggle) {
        clearWaveformSegmentPreviewViewportSync();
      }
      const previewViewportAlreadySynced =
        source === "waveform" &&
        idxChanged &&
        !opts?.shiftKey &&
        !opts?.toggle &&
        consumeWaveformSegmentPreviewViewportSync(idx, opts?.previewSessionId);

      if (previewViewportAlreadySynced) {
        selectionProfileBegin(`${source} idx=${idx} segments=${c.segments.length}`);
        lastSegmentSelectSourceRef.current = source;
        if (selectedIdxRef) selectedIdxRef.current = idx;
        if (c.selectedIdx !== idx) {
          commitSelectedIdxUi(idx, source, opts);
        }
        if (isSelectionLatencyProfileEnabled()) {
          selectionProfileScheduleFlush("waveform");
        }
        if (shouldFocusWaveformShellForSelectSource(source)) {
          selectionProfileTime("focus", focusWaveformShell);
        }
        return;
      }

      selectionProfileBegin(`${source} idx=${idx} segments=${c.segments.length}`);
      lastSegmentSelectSourceRef.current = source;
      const seg =
        shouldSeek || (shouldReveal && isWaveformLike)
          ? selectionProfileTime("resolvePlan", () => resolveSelectSegmentViewportPlan(s)).segment
          : s;

      if (isListKeyboardBurstStep(source, opts)) {
        const chromePrimaryBeforeStep = getSelectionChromeSnapshot().primaryIdx;
        selectionProfileTime("flushSelectedIdx", () => {
          const idxChangedForChrome =
            idx !== c.selectedIdx ||
            selectionChromePrimaryOutOfSync(idx) ||
            Boolean(opts?.shiftKey) ||
            Boolean(opts?.toggle);
          if (idxChangedForChrome) {
            paintSelectionChrome(c, idx, opts, source);
          }
          if (selectedIdxRef) selectedIdxRef.current = idx;
          burst.runListKeyboardBurstListScroll(idx);
        });
        const burstRevealIdxChanged =
          idx !== chromePrimaryBeforeStep || selectionChromePrimaryOutOfSync(idx);
        if (burstRevealIdxChanged) {
          burst.scheduleRevealSelectedSegment("listKeyboard");
        }
        if (isSelectionLatencyProfileEnabled()) {
          selectionProfileScheduleFlush("list");
        }
        return;
      }

      selectionProfileTime("flushSelectedIdx", () => {
        const idxChangedForChrome =
          idx !== c.selectedIdx ||
          selectionChromePrimaryOutOfSync(idx) ||
          Boolean(opts?.shiftKey) ||
          Boolean(opts?.toggle);
        const skipPreviewDuplicateWork =
          previewViewportAlreadySynced && source === "waveform";
        if (idxChangedForChrome && !skipPreviewDuplicateWork) {
          paintSelectionChrome(c, idx, opts, source);
        }
        if (isWaveformLike && idxChangedForChrome && !skipPreviewDuplicateWork) {
          burst.runWaveformSelectListScroll(idx);
        }
        const tl = scrollFitRef.current.timeline;
        if (shouldSeek && !previewViewportAlreadySynced) {
          selectionProfileTime("seek", () => {
            syncWaveformSegmentSelectSeek(tl, s);
          });
        }
        if (selectedIdxRef) selectedIdxRef.current = idx;
        if (isWaveformKeyboard) waveformKeyboardCommit.queue(idx, opts);
        else commitSelectedIdxUi(idx, source, opts);
        if (shouldReveal && isWaveformLike && !previewViewportAlreadySynced) {
          burst.cancelPendingSelectionReveal();
          selectionProfileTime("viewport", () => {
            syncWaveformSegmentSelectReveal(
              tl,
              seg,
              isWaveformKeyboard ? { forceBandPaint: false } : undefined,
            );
          });
        }
        if (source === "waveform") {
          flushTierScrollFrame({ force: true });
        }
      });
      if (shouldReveal && !isListKeyboardBurstStep(source, opts) && !isWaveformLike) {
        burst.scheduleRevealSelectedSegment(source);
      }
      if (isSelectionLatencyProfileEnabled()) {
        selectionProfileScheduleFlush(isWaveformKeyboard || !isWaveformLike ? "list" : "waveform");
      }
      if (shouldFocusWaveformShellForSelectSource(source)) {
        selectionProfileTime("focus", focusWaveformShell);
      }
    },
    [
      burst,
      commitSelectedIdxUi,
      ctxRef,
      focusWaveformShell,
      paintSelectionChrome,
      selectedIdxRef,
      waveformKeyboardCommit,
      waveformShellRef,
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
