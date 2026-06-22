import { useCallback, useEffect, useRef, type MutableRefObject, type RefObject } from "react";
import { startTransition } from "react";
import { applyListKeyboardBurstListScroll } from "../components/editor/applyListKeyboardBurstListScroll";
import { applyImperativeSegmentListSelectionScroll } from "../components/editor/applyImperativeSegmentListSelectionScroll";
import { resolveListKeyboardScrollMeta } from "../utils/listKeyboardListScrollIndex";
import type { SegmentSelectSource } from "../utils/waveformViewMode";
import type { useWaveformTimelineController } from "./useWaveformTimelineController";
import {
  selectionProfileBegin,
  selectionProfileTime,
} from "../services/ui/selectionLatencyProfile";
import { getSelectionChromeSnapshot } from "../services/selection/selectionChromeStore";
import {
  cancelListKeyboardKeyupReveal,
  markListKeyboardImperativeScrollKey,
  pinListKeyboardVirtualDisplayIndex,
  queueListKeyboardKeyupReveal,
  registerListKeyboardKeyupRevealHandler,
} from "../services/selection/listKeyboardBurstCoordinator";
import { flushTierScrollFrame } from "../utils/tierScrollFrameCoordinator";
import { isEditorFocusGateOpen } from "../utils/editorFocusGate";
import {
  SEGMENT_LIST_VIRTUALIZE_MIN_COUNT,
  segmentListItemStridePx,
  segmentListRowMinHeightPx,
} from "../utils/segmentListVirtualWindow";
import type { SegmentListFilterNavState } from "../utils/segmentListFilterNav";
import type { TranscriptionLayerInput } from "../pages/transcriptionLayerTypes";
import { shouldSkipTierRevealForSegment } from "../utils/selectionTierReveal";

type TimelineApi = ReturnType<typeof useWaveformTimelineController>;

const LIST_KEYBOARD_REVEAL_DEBOUNCE_MS = 180;

export type UseListKeyboardBurstSelectionArgs = {
  ctxRef: RefObject<TranscriptionLayerInput>;
  scrollFitRef: RefObject<{ timeline: TimelineApi }>;
  segmentListRef: RefObject<HTMLDivElement | null>;
  segmentListFilterNavRef?: MutableRefObject<SegmentListFilterNavState>;
  waveformShellRef: RefObject<HTMLElement | null>;
  setSelectedIdxUi: (idx: number, opts?: { shiftKey?: boolean; toggle?: boolean }) => void;
  transcriptRowHeightPx: number;
  lastSegmentSelectSourceRef: MutableRefObject<SegmentSelectSource>;
};

export function useListKeyboardBurstSelection(args: UseListKeyboardBurstSelectionArgs) {
  const {
    ctxRef,
    scrollFitRef,
    segmentListRef,
    segmentListFilterNavRef,
    waveformShellRef,
    setSelectedIdxUi,
    transcriptRowHeightPx,
    lastSegmentSelectSourceRef,
  } = args;

  const pendingRevealRafRef = useRef(0);
  const pendingRevealTimeoutRef = useRef(0);

  const cancelPendingSelectionReveal = useCallback(() => {
    cancelAnimationFrame(pendingRevealRafRef.current);
    pendingRevealRafRef.current = 0;
    window.clearTimeout(pendingRevealTimeoutRef.current);
    pendingRevealTimeoutRef.current = 0;
    cancelListKeyboardKeyupReveal();
  }, []);

  const resolveScrollMeta = useCallback(
    (idx: number) => {
      const c = ctxRef.current;
      const filterState = segmentListFilterNavRef?.current ?? { active: false, indices: [] };
      return resolveListKeyboardScrollMeta({
        idx,
        fileId: c.fileId,
        segmentCount: c.segments.length,
        filterActive: filterState.active,
        filteredIndices: filterState.indices,
        transcriptRowHeightPx,
        virtualizeMinCount: SEGMENT_LIST_VIRTUALIZE_MIN_COUNT,
        rowMinHeightPx: segmentListRowMinHeightPx,
        itemStridePx: segmentListItemStridePx,
      });
    },
    [ctxRef, segmentListFilterNavRef, transcriptRowHeightPx],
  );

  const revealSegmentAtIndex = useCallback(
    (idx: number, options?: { force?: boolean }) => {
      const c = ctxRef.current;
      if (idx < 0 || idx >= c.segments.length) return;
      const seg = c.segments[idx];
      const tl = scrollFitRef.current.timeline;
      const tier = tl.tierScrollRef.current;
      const dur = tl.timelineMetrics.mediaDurationSec;
      const w = tier?.clientWidth ?? 0;
      if (
        !options?.force &&
        shouldSkipTierRevealForSegment({
          seg,
          scrollLeftPx: tier?.scrollLeft ?? 0,
          viewportWidthPx: w,
          pxPerSec: tl.pxPerSec,
          durationSec: dur,
        })
      ) {
        return;
      }
      tl.viewportFit.revealSegmentInViewport({
        start_sec: seg.start_sec,
        end_sec: seg.end_sec,
      });
      flushTierScrollFrame({ force: true });
    },
    [ctxRef, scrollFitRef],
  );

  const revealSegmentAtChromePrimary = useCallback(() => {
    revealSegmentAtIndex(getSelectionChromeSnapshot().primaryIdx);
  }, [revealSegmentAtIndex]);

  const finalizeListKeyboardViewport = useCallback(
    (revealIdx?: number) => {
      cancelAnimationFrame(pendingRevealRafRef.current);
      pendingRevealRafRef.current = 0;
      window.clearTimeout(pendingRevealTimeoutRef.current);
      pendingRevealTimeoutRef.current = 0;

      const c = ctxRef.current;
      let idx = revealIdx ?? getSelectionChromeSnapshot().primaryIdx;
      if (idx < 0 || idx >= c.segments.length) {
        if (revealIdx != null) return;
        idx = c.selectedIdx;
      }
      if (idx < 0 || idx >= c.segments.length) return;

      if (revealIdx == null) {
        const editorFocusGateOpen = isEditorFocusGateOpen({
          segmentsLength: c.segments.length,
          waveformShell: waveformShellRef.current,
        });
        if (!editorFocusGateOpen) return;
      }

      selectionProfileTime("viewport", () => {
        revealSegmentAtIndex(idx);
      });
    },
    [ctxRef, revealSegmentAtIndex, waveformShellRef],
  );

  useEffect(() => {
    registerListKeyboardKeyupRevealHandler((idx) => {
      finalizeListKeyboardViewport(idx);
    });
    return () => registerListKeyboardKeyupRevealHandler(null);
  }, [finalizeListKeyboardViewport]);

  const scheduleRevealSelectedSegment = useCallback(
    (source: SegmentSelectSource) => {
      cancelAnimationFrame(pendingRevealRafRef.current);
      pendingRevealRafRef.current = 0;
      window.clearTimeout(pendingRevealTimeoutRef.current);
      pendingRevealTimeoutRef.current = 0;

      const reveal = () => {
        pendingRevealTimeoutRef.current = 0;
        selectionProfileTime("viewport", revealSegmentAtChromePrimary);
      };

      if (source === "listKeyboard") {
        pendingRevealTimeoutRef.current = window.setTimeout(
          reveal,
          LIST_KEYBOARD_REVEAL_DEBOUNCE_MS,
        );
        return;
      }

      pendingRevealRafRef.current = requestAnimationFrame(() => {
        pendingRevealRafRef.current = 0;
        const c = ctxRef.current;
        const seg = c.segments[c.selectedIdx];
        if (!seg) return;
        selectionProfileTime("viewport", () => {
          scrollFitRef.current.timeline.viewportFit.revealSegmentInViewport({
            start_sec: seg.start_sec,
            end_sec: seg.end_sec,
          });
        });
      });
    },
    [ctxRef, revealSegmentAtChromePrimary, scrollFitRef],
  );

  const runListKeyboardBurstListScroll = useCallback(
    (idx: number) => {
      const root = segmentListRef.current;
      if (!root) return;

      const meta = resolveScrollMeta(idx);
      if (!meta) return;

      selectionProfileTime("listScroll", () => {
        applyListKeyboardBurstListScroll({
          root,
          selectedDisplayIndex: meta.selectedDisplayIndex,
          selectedIdx: idx,
          rowMinHeightPx: meta.rowMinHeightPx,
          itemStridePx: meta.itemStridePx,
          useVirtualList: meta.useVirtualList,
          scrollKey: meta.scrollKey,
        });
      });
    },
    [resolveScrollMeta, segmentListRef],
  );

  const runWaveformSelectListScroll = useCallback(
    (idx: number) => {
      const root = segmentListRef.current;
      if (!root) return;

      const meta = resolveScrollMeta(idx);
      if (!meta) return;

      selectionProfileTime("listScroll", () => {
        applyImperativeSegmentListSelectionScroll({
          root,
          selectedDisplayIndex: meta.selectedDisplayIndex,
          selectedIdx: idx,
          rowMinHeightPx: meta.rowMinHeightPx,
          itemStridePx: meta.itemStridePx,
          useVirtualList: meta.useVirtualList,
          scrollKey: meta.scrollKey,
          source: "waveform",
          pinVirtualDisplayIndex: false,
        });
      });
    },
    [resolveScrollMeta, segmentListRef],
  );

  const markListKeyboardCommitScrollKey = useCallback(
    (idx: number): string | null => {
      const meta = resolveScrollMeta(idx);
      if (!meta) return null;
      markListKeyboardImperativeScrollKey(meta.scrollKey);
      pinListKeyboardVirtualDisplayIndex(meta.selectedDisplayIndex);
      return meta.scrollKey;
    },
    [resolveScrollMeta],
  );

  const commitListKeyboardBurst = useCallback(
    (idx: number) => {
      const c = ctxRef.current;
      if (c.busy || idx < 0 || idx >= c.segments.length) return;
      const scrollKey = markListKeyboardCommitScrollKey(idx);
      cancelAnimationFrame(pendingRevealRafRef.current);
      pendingRevealRafRef.current = 0;
      window.clearTimeout(pendingRevealTimeoutRef.current);
      pendingRevealTimeoutRef.current = 0;
      if (scrollKey) {
        queueListKeyboardKeyupReveal({ idx, scrollKey });
      }
      lastSegmentSelectSourceRef.current = "listKeyboard";
      if (c.selectedIdxRef) {
        c.selectedIdxRef.current = idx;
      }
      selectionProfileBegin(`listKeyboard commit idx=${idx} segments=${c.segments.length}`);
      startTransition(() => {
        setSelectedIdxUi(idx);
      });
    },
    [
      ctxRef,
      lastSegmentSelectSourceRef,
      markListKeyboardCommitScrollKey,
      setSelectedIdxUi,
    ],
  );

  return {
    runListKeyboardBurstListScroll,
    runWaveformSelectListScroll,
    commitListKeyboardBurst,
    finalizeListKeyboardViewport,
    cancelPendingSelectionReveal,
    scheduleRevealSelectedSegment,
  };
}
