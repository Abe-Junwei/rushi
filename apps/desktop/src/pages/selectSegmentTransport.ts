import type { MutableRefObject, RefObject } from "react";
import { resolveSelectSegmentViewportPlan } from "../services/waveform/selectSegmentViewportPlan";
import {
  syncWaveformSegmentSelectReveal,
  syncWaveformSegmentSelectSeek,
} from "../services/waveform/syncWaveformSegmentSelectViewport";
import {
  clearWaveformSegmentPreviewViewportSync,
  consumeWaveformSegmentPreviewViewportSync,
} from "../services/waveform/waveformSegmentSelectPreviewSync";
import type { SegmentSelectAtOptions, SegmentSelectSource } from "../utils/waveformViewMode";
import {
  isListKeyboardBurstStep,
  isWaveformKeyboardBurstStep,
  shouldFocusWaveformShellForSelectSource,
} from "../utils/waveformViewMode";
import type { useWaveformTimelineController } from "../hooks/useWaveformTimelineController";
import {
  selectionProfileBegin,
  selectionProfileFlush,
  selectionProfileMarkFirstPaint,
  selectionProfileScheduleFlush,
  selectionProfileTime,
  isSelectionLatencyProfileEnabled,
  shouldMarkSelectionProfileListCommit,
} from "../services/ui/selectionLatencyProfile";
import { dispatchTranscriptEditorSelection } from "../components/editor/core/transcriptEditorViewHandle";
import { revealSegmentInView } from "../components/editor/core/revealSegment";
import { getTranscriptEditorView } from "../components/editor/core/transcriptEditorViewHandle";
import { effectiveTranscriptPrimaryIdx } from "../components/editor/core/projectionWaveformBridge";
import { flushTierScrollFrame } from "../utils/tierScrollFrameCoordinator";
import {
  shouldRevealOnSegmentSelect,
  shouldSeekAfterSegmentSelect,
} from "../utils/selectionRevealSeekPolicy";
import { shouldSuppressSegmentSelectSeekForFileViewRestore } from "../services/fileViewStateBridge";
import type { TranscriptionLayerInput } from "./transcriptionLayerTypes";

type TimelineApi = ReturnType<typeof useWaveformTimelineController>;

export type SelectSegmentTransportDeps = {
  ctxRef: RefObject<TranscriptionLayerInput>;
  scrollFitRef: RefObject<{ timeline: TimelineApi }>;
  segmentListRef: RefObject<HTMLDivElement | null>;
  selectedIdxRef?: MutableRefObject<number>;
  lastSegmentSelectSourceRef: MutableRefObject<SegmentSelectSource>;
  scheduleRevealSelectedSegment: (source: SegmentSelectSource, idx: number) => void;
  revealSelectedSegmentNow: (idx: number, options?: { force?: boolean }) => void;
  cancelPendingSelectionReveal: () => void;
  focusWaveformShell: () => void;
  notifyPlaybackFollowSegmentSelect?: (idx: number) => void;
  /** List listen-jump: tear segment bound for global, or open segment play when sticky segment session. */
  beginGlobalPlayback?: (idx?: number) => void;
  /** Any segment select exits blank-seek global Space lock. */
  clearBlankGlobalSpaceArm?: () => void;
};

/**
 * P9b2 select transport: CM6 dispatch + seek/reveal/focus.
 * No SC1 React commit, no SC2 paint, no burst keyup SC1 deferral.
 */
export function selectSegmentTransport(
  idx: number,
  source: SegmentSelectSource,
  opts: SegmentSelectAtOptions | undefined,
  deps: SelectSegmentTransportDeps,
): void {
  const {
    ctxRef,
    scrollFitRef,
    segmentListRef,
    selectedIdxRef,
    lastSegmentSelectSourceRef,
    scheduleRevealSelectedSegment,
    revealSelectedSegmentNow,
    cancelPendingSelectionReveal,
    focusWaveformShell,
    notifyPlaybackFollowSegmentSelect,
    beginGlobalPlayback,
    clearBlankGlobalSpaceArm,
  } = deps;

  const c = ctxRef.current;
  if (c.busy) return;
  const s = c.segments[idx];
  if (!s) return;

  // Selecting a segment restores Space → scoped-on-selection (exits blank-seek global lock).
  clearBlankGlobalSpaceArm?.();

  const isWaveformKeyboard = source === "waveformKeyboard";
  const isWaveformKbBurst = isWaveformKeyboardBurstStep(source, opts);
  const isBurstStep = isListKeyboardBurstStep(source, opts) || isWaveformKbBurst;
  const isWaveformLike = source === "waveform" || isWaveformKeyboard;
  const isListListenJump =
    (source === "list" || source === "listAdvance" || source === "listKeyboard") &&
    !opts?.shiftKey &&
    !opts?.toggle;

  const authorityPrimary = effectiveTranscriptPrimaryIdx(c.selectedIdx);
  const idxChangedFromAuthority = idx !== authorityPrimary;
  // CM6 mousedown updates projection before transport — list seek must use React/ref baseline.
  const reactPrimaryIdx = selectedIdxRef?.current ?? c.selectedIdxRef?.current ?? c.selectedIdx;
  const previewViewportAlreadySynced =
    source === "waveform" &&
    idxChangedFromAuthority &&
    !opts?.shiftKey &&
    !opts?.toggle &&
    consumeWaveformSegmentPreviewViewportSync(idx, opts?.previewSessionId);
  const suppressRestoreSelectSeek = shouldSuppressSegmentSelectSeekForFileViewRestore();
  const shouldReveal = shouldRevealOnSegmentSelect({
    source,
    idxChanged: idxChangedFromAuthority,
    forceSeek: opts?.forceSeek,
  });
  const shouldSeek =
    !suppressRestoreSelectSeek &&
    shouldSeekAfterSegmentSelect({
      source,
      idx,
      projectionPrimaryIdx: authorityPrimary,
      reactPrimaryIdx,
      shiftKey: opts?.shiftKey,
      toggle: opts?.toggle,
      forceSeek: opts?.forceSeek,
    });
  // Waveform reveal recenters tier scroll — skip while restoring view-state.
  const shouldRevealWaveform = shouldReveal && isWaveformLike && !suppressRestoreSelectSeek;
  const shouldRevealList = shouldReveal && !isWaveformLike;
  if (source !== "waveform" || opts?.shiftKey || opts?.toggle) {
    clearWaveformSegmentPreviewViewportSync();
  }
  if (isListListenJump) {
    notifyPlaybackFollowSegmentSelect?.(idx);
  }
  if (shouldSeek && isListListenJump) {
    beginGlobalPlayback?.(idx);
  }
  dispatchTranscriptEditorSelection(idx, {
    shiftKey: opts?.shiftKey,
    toggle: opts?.toggle,
    // List pointer already landed on the row. CM transaction scrollIntoView
    // fights filter-collapse geometry and yanks the viewport backward.
    // listKeyboard uses revealSegmentInView (DOM) below / in burst path.
    scrollIntoView:
      shouldReveal &&
      source !== "list" &&
      source !== "listAdvance" &&
      source !== "listKeyboard",
  });
  if (selectedIdxRef) selectedIdxRef.current = idx;
  if (c.selectedIdxRef) c.selectedIdxRef.current = idx;

  if (previewViewportAlreadySynced) {
    selectionProfileBegin(`${source} idx=${idx} segments=${c.segments.length}`);
    selectionProfileMarkFirstPaint();
    lastSegmentSelectSourceRef.current = source;
    if (isSelectionLatencyProfileEnabled()) {
      const listOwnsFlush =
        segmentListRef.current != null && shouldMarkSelectionProfileListCommit(source);
      if (listOwnsFlush) selectionProfileFlush();
      else selectionProfileScheduleFlush(source === "waveform" ? "waveform" : "list");
    }
    if (shouldFocusWaveformShellForSelectSource(source) && !opts?.preferSegmentTextFocus) {
      selectionProfileTime("focus", focusWaveformShell);
    }
    return;
  }

  if (!isBurstStep) {
    selectionProfileBegin(`${source} idx=${idx} segments=${c.segments.length}`);
  }
  lastSegmentSelectSourceRef.current = source;
  const seg =
    shouldSeek || shouldRevealWaveform
      ? selectionProfileTime("resolvePlan", () => resolveSelectSegmentViewportPlan(s)).segment
      : s;

  if (isBurstStep) {
    selectionProfileTime("flushSelectedIdx", () => {
      const view = getTranscriptEditorView();
      if (view) revealSegmentInView(view, idx);
      if (isWaveformKbBurst && shouldSeek) {
        const tl = scrollFitRef.current.timeline;
        selectionProfileTime("seek", () => {
          syncWaveformSegmentSelectSeek(tl, s, { segmentIdx: idx, source });
        });
        selectionProfileTime("viewport", () => {
          syncWaveformSegmentSelectReveal(tl, s, { forceBandPaint: false });
        });
      }
    });
    if (!isWaveformKbBurst) {
      scheduleRevealSelectedSegment("listKeyboard", idx);
    }
    if (shouldFocusWaveformShellForSelectSource(source) && !opts?.preferSegmentTextFocus) {
      selectionProfileTime("focus", focusWaveformShell);
    }
    return;
  }

  selectionProfileTime("flushSelectedIdx", () => {
    if (isWaveformLike && idxChangedFromAuthority) {
      const view = getTranscriptEditorView();
      if (view) revealSegmentInView(view, idx);
    }
    const tl = scrollFitRef.current.timeline;
    if (shouldSeek) {
      selectionProfileTime("seek", () => {
        syncWaveformSegmentSelectSeek(tl, s, { segmentIdx: idx, source });
      });
    }
    if (shouldRevealWaveform) {
      cancelPendingSelectionReveal();
      selectionProfileTime("viewport", () => {
        syncWaveformSegmentSelectReveal(
          tl,
          seg,
          isWaveformKeyboard ? { forceBandPaint: false } : undefined,
        );
      });
    }
    if (shouldRevealList) {
      cancelPendingSelectionReveal();
      // Keep list/listKeyboard reveal in the same JS turn as selection + seek.
      // Deferring this by rAF/timeout paints the new highlight once in the old
      // viewport, then again after centering, which is the visible ↑↓ jitter.
      revealSelectedSegmentNow(idx);
      if (source === "listKeyboard") {
        const view = getTranscriptEditorView();
        if (view) revealSegmentInView(view, idx);
      }
    }
    if (source === "waveform") {
      flushTierScrollFrame({ force: true });
    }
  });

  if (isSelectionLatencyProfileEnabled()) {
    const listOwnsFlush =
      segmentListRef.current != null && shouldMarkSelectionProfileListCommit(source);
    if (listOwnsFlush) selectionProfileFlush();
    else selectionProfileScheduleFlush(source === "waveform" ? "waveform" : "list");
  }
  if (shouldFocusWaveformShellForSelectSource(source) && !opts?.preferSegmentTextFocus) {
    selectionProfileTime("focus", focusWaveformShell);
  }
}
