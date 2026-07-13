import { useCallback, useEffect, useRef, type MutableRefObject, type RefObject } from "react";
import { resolveListKeyboardScrollMeta } from "../utils/listKeyboardListScrollIndex";
import type { SegmentSelectSource } from "../utils/waveformViewMode";
import type { useWaveformTimelineController } from "./useWaveformTimelineController";
import {
  selectionProfileBegin,
  selectionProfileMarkListCommit,
  selectionProfileTime,
} from "../services/ui/selectionLatencyProfile";
import {
  cancelListKeyboardKeyupReveal,
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
import { getTranscriptEditorView } from "../components/editor/core/transcriptEditorViewHandle";
import { revealSegmentInView } from "../components/editor/core/revealSegment";
import { effectiveTranscriptPrimaryIdx } from "../components/editor/core/projectionWaveformBridge";
import { syncWaveformSegmentSelectSeek } from "../services/waveform/syncWaveformSegmentSelectViewport";

type TimelineApi = ReturnType<typeof useWaveformTimelineController>;

/** Keep debounce for hold-without-keyup (LKB-H5); keyup finalize cancels pending timer. */
const LIST_KEYBOARD_REVEAL_DEBOUNCE_MS = 180;

export type UseListKeyboardBurstSelectionArgs = {
  ctxRef: RefObject<TranscriptionLayerInput>;
  scrollFitRef: RefObject<{ timeline: TimelineApi }>;
  segmentListRef: RefObject<HTMLDivElement | null>;
  segmentListFilterNavRef?: MutableRefObject<SegmentListFilterNavState>;
  waveformShellRef: RefObject<HTMLElement | null>;
  transcriptRowHeightPx: number;
  lastSegmentSelectSourceRef: MutableRefObject<SegmentSelectSource>;
  /** Clear scoped end-bound when keyboard listen-jump seeks on finalize. */
  beginGlobalPlayback?: (idx?: number) => void;
};

export function useListKeyboardBurstSelection(args: UseListKeyboardBurstSelectionArgs) {
  const {
    ctxRef,
    scrollFitRef,
    segmentListFilterNavRef,
    waveformShellRef,
    transcriptRowHeightPx,
    lastSegmentSelectSourceRef,
    beginGlobalPlayback,
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

  const finalizeListKeyboardViewport = useCallback(
    (revealIdx?: number) => {
      cancelAnimationFrame(pendingRevealRafRef.current);
      pendingRevealRafRef.current = 0;
      window.clearTimeout(pendingRevealTimeoutRef.current);
      pendingRevealTimeoutRef.current = 0;

      const c = ctxRef.current;
      let idx = revealIdx ?? effectiveTranscriptPrimaryIdx(c.selectedIdx);
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
      const seg = c.segments[idx];
      if (seg) {
        beginGlobalPlayback?.(idx);
        const tl = scrollFitRef.current.timeline;
        selectionProfileTime("seek", () => {
          syncWaveformSegmentSelectSeek(tl, seg, {
            segmentIdx: idx,
            source: "listKeyboard",
          });
        });
      }
    },
    [beginGlobalPlayback, ctxRef, revealSegmentAtIndex, scrollFitRef, waveformShellRef],
  );

  useEffect(() => {
    registerListKeyboardKeyupRevealHandler((idx) => {
      finalizeListKeyboardViewport(idx);
    });
    return () => registerListKeyboardKeyupRevealHandler(null);
  }, [finalizeListKeyboardViewport]);

  const scheduleRevealSelectedSegment = useCallback(
    (source: SegmentSelectSource, idx: number) => {
      cancelAnimationFrame(pendingRevealRafRef.current);
      pendingRevealRafRef.current = 0;
      window.clearTimeout(pendingRevealTimeoutRef.current);
      pendingRevealTimeoutRef.current = 0;

      // Prefer the transport idx — React `selectedIdx` lags after P9b2 (CM6 is SoT).
      const reveal = () => {
        pendingRevealTimeoutRef.current = 0;
        selectionProfileTime("viewport", () => {
          revealSegmentAtIndex(idx);
        });
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
        selectionProfileTime("viewport", () => {
          revealSegmentAtIndex(idx);
        });
      });
    },
    [revealSegmentAtIndex],
  );

  const revealSelectedSegmentNow = useCallback(
    (idx: number, options?: { force?: boolean }) => {
      selectionProfileTime("viewport", () => {
        revealSegmentAtIndex(idx, options);
      });
    },
    [revealSegmentAtIndex],
  );

  const runListKeyboardBurstListScroll = useCallback((idx: number) => {
    const view = getTranscriptEditorView();
    if (!view) return;
    selectionProfileTime("listScroll", () => {
      revealSegmentInView(view, idx);
    });
  }, []);

  const runWaveformSelectListScroll = useCallback((idx: number) => {
    const view = getTranscriptEditorView();
    if (!view) return;
    selectionProfileTime("listScroll", () => {
      revealSegmentInView(view, idx);
    });
  }, []);

  const markListKeyboardCommitScrollKey = useCallback(
    (idx: number): string | null => {
      const meta = resolveScrollMeta(idx);
      if (!meta) return null;
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
      selectionProfileMarkListCommit();
      // P9b2: CM6 already holds selection from burst mid-steps; no SC1 startTransition.
    },
    [ctxRef, lastSegmentSelectSourceRef, markListKeyboardCommitScrollKey],
  );

  return {
    runListKeyboardBurstListScroll,
    runWaveformSelectListScroll,
    commitListKeyboardBurst,
    finalizeListKeyboardViewport,
    cancelPendingSelectionReveal,
    scheduleRevealSelectedSegment,
    revealSelectedSegmentNow,
  };
}
