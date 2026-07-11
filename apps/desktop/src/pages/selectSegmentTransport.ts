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
  shouldSeekOnSegmentSelect,
} from "../utils/selectionRevealSeekPolicy";
import type { TranscriptionLayerInput } from "./transcriptionLayerTypes";

type TimelineApi = ReturnType<typeof useWaveformTimelineController>;

export type SelectSegmentTransportDeps = {
  ctxRef: RefObject<TranscriptionLayerInput>;
  scrollFitRef: RefObject<{ timeline: TimelineApi }>;
  segmentListRef: RefObject<HTMLDivElement | null>;
  selectedIdxRef?: MutableRefObject<number>;
  lastSegmentSelectSourceRef: MutableRefObject<SegmentSelectSource>;
  scheduleRevealSelectedSegment: (source: SegmentSelectSource, idx: number) => void;
  cancelPendingSelectionReveal: () => void;
  focusWaveformShell: () => void;
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
    cancelPendingSelectionReveal,
    focusWaveformShell,
  } = deps;

  const c = ctxRef.current;
  if (c.busy) return;
  const s = c.segments[idx];
  if (!s) return;

  const isWaveformKeyboard = source === "waveformKeyboard";
  const isWaveformKbBurst = isWaveformKeyboardBurstStep(source, opts);
  const isBurstStep = isListKeyboardBurstStep(source, opts) || isWaveformKbBurst;
  const isWaveformLike = source === "waveform" || isWaveformKeyboard;

  const authorityPrimary = effectiveTranscriptPrimaryIdx(c.selectedIdx);
  const idxChangedFromAuthority = idx !== authorityPrimary;
  const previewViewportAlreadySynced =
    source === "waveform" &&
    idxChangedFromAuthority &&
    !opts?.shiftKey &&
    !opts?.toggle &&
    consumeWaveformSegmentPreviewViewportSync(idx, opts?.previewSessionId);
  const shouldReveal = shouldRevealOnSegmentSelect({
    source,
    idxChanged: idxChangedFromAuthority,
  });
  const shouldSeek = shouldSeekOnSegmentSelect(source) && idxChangedFromAuthority;
  if (source !== "waveform" || opts?.shiftKey || opts?.toggle) {
    clearWaveformSegmentPreviewViewportSync();
  }

  dispatchTranscriptEditorSelection(idx, {
    shiftKey: opts?.shiftKey,
    toggle: opts?.toggle,
    scrollIntoView: shouldReveal,
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
    shouldSeek || (shouldReveal && isWaveformLike)
      ? selectionProfileTime("resolvePlan", () => resolveSelectSegmentViewportPlan(s)).segment
      : s;

  if (isBurstStep) {
    selectionProfileTime("flushSelectedIdx", () => {
      const view = getTranscriptEditorView();
      if (view) revealSegmentInView(view, idx);
      if (isWaveformKbBurst && shouldSeek) {
        const tl = scrollFitRef.current.timeline;
        selectionProfileTime("seek", () => {
          syncWaveformSegmentSelectSeek(tl, s, { segmentIdx: idx });
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
        syncWaveformSegmentSelectSeek(tl, s, { segmentIdx: idx });
      });
    }
    if (shouldReveal && isWaveformLike) {
      cancelPendingSelectionReveal();
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

  if (shouldReveal && !isWaveformLike) {
    scheduleRevealSelectedSegment(source, idx);
  }
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
