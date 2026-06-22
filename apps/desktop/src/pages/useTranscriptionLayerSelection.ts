import { useCallback, useMemo, useRef, type MutableRefObject, type RefObject } from "react";
import { startTransition } from "react";
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
import type { SegmentSelectAtOptions, SegmentSelectSource } from "../utils/waveformViewMode";
import { shouldFocusWaveformShellForSelectSource } from "../utils/waveformViewMode";
import type { useWaveformTimelineController } from "../hooks/useWaveformTimelineController";
import {
  selectionProfileBegin,
  selectionProfileScheduleFlush,
  selectionProfileTime,
  isSelectionLatencyProfileEnabled,
} from "../services/ui/selectionLatencyProfile";
import { publishSelectionChromeForInput } from "../services/selection/publishSelectionChromeForInput";
import { resolveSelectionChromePreview } from "../services/selection/resolveSelectionChromePreview";
import { applyContextMenuSelectionBeforeOpen } from "../services/selection/segmentContextMenuSelection";
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
import { isListSegmentSelectSource } from "../utils/segmentListSelectSource";
import type { TranscriptionLayerInput } from "./transcriptionLayerTypes";

type TimelineApi = ReturnType<typeof useWaveformTimelineController>;

function isListKeyboardBurstStep(
  source: SegmentSelectSource,
  opts?: SegmentSelectAtOptions,
): boolean {
  return source === "listKeyboard" && opts?.burst === true && !opts?.shiftKey && !opts?.toggle;
}

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
    (idx: number, source?: SegmentSelectSource, opts?: SegmentSelectAtOptions) => void
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
    (
      idx: number,
      source: SegmentSelectSource,
      opts?: SegmentSelectAtOptions,
    ) => {
      if (isListSegmentSelectSource(source)) {
        setSelectedIdxUi(idx, opts);
        return;
      }
      startTransition(() => {
        setSelectedIdxUi(idx, opts);
      });
    },
    [setSelectedIdxUi],
  );

  const paintSelectionChrome = useCallback(
    (
      c: TranscriptionLayerInput,
      idx: number,
      opts: { shiftKey?: boolean; toggle?: boolean } | undefined,
      source: SegmentSelectSource,
    ) => {
      const preview = resolveSelectionChromePreview(c, idx, opts);
      const tier = scrollFitRef.current.timeline.tierScrollRef.current;
      publishSelectionChromeForInput(
        c,
        { primaryIdx: preview.primaryIdx, selectedSet: preview.selectedSet },
        {
          listRoot: segmentListRef.current,
          overlayRoot: tier?.querySelector(".waveform-timeline-overlay-layer") ?? null,
        },
        {
          markFirstPaint: isSelectionLatencyProfileEnabled(),
          // listKeyboard defers SC1 — band must repaint from chrome store, not React selectedIdx.
          skipBandPaint: source === "list" || source === "listAdvance",
        },
      );
    },
    [segmentListRef],
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
      selectionProfileBegin(`${source} idx=${idx} segments=${c.segments.length}`);
      lastSegmentSelectSourceRef.current = source;
      const seg =
        shouldSeek || (shouldReveal && source === "waveform")
          ? selectionProfileTime("resolvePlan", () => resolveSelectSegmentViewportPlan(s)).segment
          : s;
      if (shouldSeek) {
        const tl = scrollFitRef.current.timeline;
        selectionProfileTime("seek", () => {
          tl.suppressPlaybackFollowForSelectionSeek();
          tl.wfApiRef.current.seek(segmentStartSec(s));
        });
      }

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
          if (selectedIdxRef) {
            selectedIdxRef.current = idx;
          }
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
        if (idxChangedForChrome) {
          paintSelectionChrome(c, idx, opts, source);
        }
        if (source === "waveform" && idxChangedForChrome) {
          burst.runWaveformSelectListScroll(idx);
        }
        commitSelectedIdxUi(idx, source, opts);
        if (source === "waveform") {
          flushTierScrollFrame({ force: true });
        }
      });
      if (shouldReveal && !isListKeyboardBurstStep(source, opts)) {
        if (source === "waveform") {
          burst.cancelPendingSelectionReveal();
          selectionProfileTime("viewport", () => {
            scrollFitRef.current.timeline.viewportFit.revealSegmentInViewport({
              start_sec: seg.start_sec,
              end_sec: seg.end_sec,
            });
          });
          flushTierScrollFrame({ force: true });
        } else {
          burst.scheduleRevealSelectedSegment(source);
        }
      }
      if (isSelectionLatencyProfileEnabled()) {
        selectionProfileScheduleFlush(source === "waveform" ? "waveform" : "list");
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
      waveformShellRef,
    ],
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
        (idx, source) => selectSegmentAt(idx, source),
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
    [ctxRef, segmentLaneLayout.laneByIndex, segmentLaneLayout.laneCount, selectSegmentAt, timeline.timelineMetrics.mediaDurationSec, timeline.wfApiRef],
  );

  return {
    segmentLaneLayout,
    focusWaveformShell,
    revealSelectedSegmentInViewport,
    cancelPendingSelectionReveal: burst.cancelPendingSelectionReveal,
    finalizeListKeyboardViewport: burst.finalizeListKeyboardViewport,
    commitListKeyboardBurst: burst.commitListKeyboardBurst,
    selectSegmentAt,
    selectSegmentAtRef,
    lastSegmentSelectSourceRef,
    stepWaveformZoomRef,
    openSegmentContextMenuFromPointer,
  };
}
