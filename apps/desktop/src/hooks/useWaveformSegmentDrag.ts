import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { hitSegmentEdgeFromTimelinePointer, resolvePackableSegmentPaintedNeighbors, resolveSegmentIndexAtWaveformPointer } from "../utils/waveformSegmentBounds";
import { effectiveTranscriptPrimaryIdx } from "../components/editor/core/projectionWaveformBridge";
import { isSegmentSnapEnabled, readSegmentOverlayModifiers } from "../utils/segmentOverlayModifiers";
import type { CreateRangePreview, OverlayDragState, SegmentOverlayDraft } from "../utils/waveformSegmentOverlayGeometry";
import type { SegmentOverlayTapGesture } from "../utils/waveformSegmentOverlayActions";
import { resolveBlankOverlayShellDragMode } from "../utils/waveformSegmentOverlayGestures";
import {
  WAVEFORM_OVERLAY_SUPPRESS_CLICK_MS,
  releasePointerCaptureIfHeld,
} from "../utils/waveformSegmentDragSession";
import {
  beginWaveformSegmentInteraction,
  beginWaveformSegmentLassoInteraction,
  cancelWaveformSegmentInteraction,
  commitWaveformSegmentInteraction,
  consumeWaveformSegmentTapGesture,
  markWaveformSegmentInteractionMoved,
  type WaveformSegmentInteractionState,
} from "../services/waveform/waveformSegmentInteractionStateMachine";
import {
  finishWaveformEditDrag,
  finishWaveformLassoDrag,
  updateWaveformOverlayDragMove,
} from "./waveformSegmentDragHelpers";
import type { WaveformSelectionGesture } from "../services/waveform/waveformSelectionGesture";
import { useOptionalWaveformListVisibleIndexSet } from "./WaveformSelectionChromeViewContext";

export type WaveformSegmentDragArgs = {
  disabled: boolean;
  segments: import("../tauri/projectApi").SegmentDto[];
  selectedIdx: number;
  timelineWidthPx: number;
  durationSec: number;
  getPlayheadSec?: () => number;
  layoutHeightPx: number;
  laneByIndex: number[];
  laneCount: number;
  enableCreateRange: boolean;
  clientXToTimeSec: (clientX: number) => number;
  onSelectSegmentAt: (idx: number, opts?: { shiftKey?: boolean; toggle?: boolean }) => void;
  onWaveformSelectionGesture?: (gesture: WaveformSelectionGesture) => boolean | void;
  /** @deprecated 使用 onWaveformSelectionGesture down phase */
  onPreviewSegmentSelect?: (idx: number) => boolean;
  onSelectSegmentIndices?: (indices: number[], primaryIdx: number) => void;
  getSelectedIndices?: () => ReadonlySet<number>;
  onBeginBoundsEdit?: () => void;
  onFocusWaveformShell?: () => void;
  onBoundsCommit: (
    idx: number,
    startSec: number,
    endSec: number,
    options?: {
      neighborPatches?: Array<{ idx: number; startSec: number; endSec: number }>;
      deleteIndices?: number[];
    },
  ) => void;
  onCreateRange?: (
    startSec: number,
    endSec: number,
    options?: { overlapPolicy?: import("../utils/segmentTimeRange").SegmentOverlapPolicy },
  ) => void;
  onSelectTimeRange?: (startSec: number, endSec: number) => void;
  seekToTime: (timeSec: number) => void;
  seekBlankToTime?: (timeSec: number) => void;
  suppressPlaybackFollowForSelectionSeek?: () => void;
  onClearMultiSelection?: () => void;
  isMultiSegmentSelection?: () => boolean;
  /** Filter-visible indices; null = all hittable/selectable via lasso. */
  listVisibleIndexSet?: ReadonlySet<number> | null;
};

export function useWaveformSegmentDrag(
  argsRef: React.MutableRefObject<WaveformSegmentDragArgs>,
  applySegmentDraft: (draft: SegmentOverlayDraft | null) => void,
  updateCreatePreview: (preview: CreateRangePreview | null) => void,
  onSegmentPointerTap: (
    segmentIdx: number,
    pointerTimeSec: number,
    tapGesture?: SegmentOverlayTapGesture,
  ) => void,
) {
  const listVisibleIndexSet = useOptionalWaveformListVisibleIndexSet();
  const listVisibleIndexSetRef = useRef(listVisibleIndexSet);
  listVisibleIndexSetRef.current = listVisibleIndexSet;

  const dragRef = useRef<OverlayDragState | null>(null);
  const interactionStateRef = useRef<WaveformSegmentInteractionState>({ phase: "idle" });
  const suppressClickUntilRef = useRef(0);
  const onSegmentPointerTapRef = useRef(onSegmentPointerTap);
  onSegmentPointerTapRef.current = onSegmentPointerTap;

  const suppressClickAfterPointer = useCallback(() => {
    suppressClickUntilRef.current = performance.now() + WAVEFORM_OVERLAY_SUPPRESS_CLICK_MS;
  }, []);

  const consumeLastSegmentTapGesture = useCallback((segmentIdx: number): SegmentOverlayTapGesture | undefined => {
    const gesture = consumeWaveformSegmentTapGesture(interactionStateRef.current, segmentIdx);
    if (gesture) {
      interactionStateRef.current = commitWaveformSegmentInteraction(interactionStateRef.current);
    }
    return gesture;
  }, []);

  const finishDrag = useCallback(
    (ev: ReactPointerEvent<HTMLElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== ev.pointerId) return;
      dragRef.current = null;
      interactionStateRef.current = commitWaveformSegmentInteraction(interactionStateRef.current);
      const a = argsRef.current;
      const modifiers = readSegmentOverlayModifiers(ev);
      const snapEnabled = isSegmentSnapEnabled(modifiers);
      const timeSec = a.clientXToTimeSec(ev.clientX);

      if (drag.mode === "lasso") {
        updateCreatePreview(null);
        applySegmentDraft(null);
        finishWaveformLassoDrag({
          drag,
          timeSec,
          args: { ...a, listVisibleIndexSet: listVisibleIndexSetRef.current },
          snapEnabled,
          modifiers,
          suppressClickAfterPointer,
        });
        return;
      }

      applySegmentDraft(null);
      finishWaveformEditDrag({
        drag,
        timeSec,
        args: a,
        snapEnabled,
        ev,
        onSegmentPointerTap: onSegmentPointerTapRef.current,
        suppressClickAfterPointer,
      });
    },
    [applySegmentDraft, argsRef, updateCreatePreview, suppressClickAfterPointer],
  );

  const onSegmentPointerDown = useCallback(
    (idx: number, ev: ReactPointerEvent<HTMLElement>) => {
      const a = argsRef.current;
      if (a.disabled || ev.button !== 0) return;
      const visible = listVisibleIndexSetRef.current;
      // Hidden-by-filter primary keeps visual chrome but is non-interactive.
      if (visible && !visible.has(idx)) return;
      const seg = a.segments[idx];
      if (!seg) return;
      ev.stopPropagation();
      // Always preventDefault: WebView2 otherwise starts native drag/selection chrome
      // (window flash) on segment move; resize already needed it for capture.
      ev.preventDefault();
      const neighbors = resolvePackableSegmentPaintedNeighbors(
        a.segments,
        idx,
        a.durationSec,
      );
      const mode = hitSegmentEdgeFromTimelinePointer({
        pointerTimeSec: a.clientXToTimeSec(ev.clientX),
        startSec: seg.start_sec,
        endSec: seg.end_sec,
        timelineWidthPx: a.timelineWidthPx,
        durationSec: a.durationSec,
        prevPaintedEndSec: neighbors.prevPaintedEndSec,
        nextPaintedStartSec: neighbors.nextPaintedStartSec,
      });
      if (mode === "resize-start" || mode === "resize-end" || mode === "move") {
        a.onBeginBoundsEdit?.();
      }
      const modifiers = readSegmentOverlayModifiers(ev);
      const interaction = beginWaveformSegmentInteraction({
        mode,
        pointerId: ev.pointerId,
        segmentIdx: idx,
        anchorTimeSec: a.clientXToTimeSec(ev.clientX),
        anchorClientX: ev.clientX,
        initialStartSec: seg.start_sec,
        initialEndSec: seg.end_sec,
        selectedIdxAtPointerDown: effectiveTranscriptPrimaryIdx(a.selectedIdx),
      });
      interactionStateRef.current = interaction.state;
      dragRef.current = interaction.state.drag;
      if (mode === "move" && !modifiers.shiftKey && !modifiers.toggleKey) {
        const viewportSyncedOnDown =
          a.onWaveformSelectionGesture?.({ phase: "down", idx, sessionId: interaction.state.sessionId }) === true ||
          a.onPreviewSegmentSelect?.(idx) === true;
        if (viewportSyncedOnDown && dragRef.current) {
          dragRef.current.viewportSyncedOnDown = true;
          interaction.state.drag.viewportSyncedOnDown = true;
          interaction.state.tapGesture.viewportSyncedOnDown = true;
        }
      }
      applySegmentDraft(interaction.draft);
      ev.currentTarget.setPointerCapture(ev.pointerId);
    },
    [applySegmentDraft, argsRef],
  );

  const onShellPointerDown = useCallback(
    (ev: ReactPointerEvent<HTMLElement>) => {
      const a = argsRef.current;
      if (a.disabled || ev.button !== 0) return;
      // Blank seek / lasso: block WebView2 native drag ghost (flash) and text select.
      ev.preventDefault();

      const timeSec = a.clientXToTimeSec(ev.clientX);
      const effectivePrimary = effectiveTranscriptPrimaryIdx(a.selectedIdx);
      const hitIdx = resolveSegmentIndexAtWaveformPointer({
        segments: a.segments,
        timeSec,
        pointerClientY: ev.clientY,
        overlayClientTop: ev.currentTarget.getBoundingClientRect().top,
        layoutHeightPx: a.layoutHeightPx,
        laneByIndex: a.laneByIndex,
        laneCount: a.laneCount,
        selectedIdx: effectivePrimary >= 0 ? effectivePrimary : a.selectedIdx,
        durationSec: a.durationSec,
        timelineWidthPx: a.timelineWidthPx,
        listVisibleIndexSet: listVisibleIndexSetRef.current,
      });
      if (hitIdx >= 0) {
        onSegmentPointerDown(hitIdx, ev);
        return;
      }

      const blankMode = resolveBlankOverlayShellDragMode({
        enableCreateRange: a.enableCreateRange,
        hasOnCreateRange: Boolean(a.onCreateRange),
      });

      if (blankMode === "lasso") {
        const modifiers = readSegmentOverlayModifiers(ev);
        const baseIndices = ev.shiftKey
          ? new Set(a.getSelectedIndices?.() ?? [])
          : new Set<number>();
        const interaction = beginWaveformSegmentLassoInteraction({
          pointerId: ev.pointerId,
          anchorTimeSec: timeSec,
          anchorClientX: ev.clientX,
          selectedIdxAtPointerDown: effectiveTranscriptPrimaryIdx(a.selectedIdx),
          baseIndices,
        });
        interactionStateRef.current = interaction;
        dragRef.current = interaction.drag;
        if (!modifiers.shiftKey && !modifiers.toggleKey) {
          a.onFocusWaveformShell?.();
          a.suppressPlaybackFollowForSelectionSeek?.();
          (a.seekBlankToTime ?? a.seekToTime)(timeSec);
          interaction.drag.blankSeekedOnDown = true;
        }
        ev.currentTarget.setPointerCapture(ev.pointerId);
        return;
      }

      a.onFocusWaveformShell?.();
      a.suppressPlaybackFollowForSelectionSeek?.();
      (a.seekBlankToTime ?? a.seekToTime)(timeSec);
    },
    [argsRef, onSegmentPointerDown],
  );

  const onPointerMove = useCallback(
    (ev: ReactPointerEvent<HTMLElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== ev.pointerId) return;
      const a = argsRef.current;
      const snapEnabled = isSegmentSnapEnabled(readSegmentOverlayModifiers(ev));
      const timeSec = a.clientXToTimeSec(ev.clientX);
      const movedBefore = drag.moved;

      updateWaveformOverlayDragMove({
        drag,
        clientX: ev.clientX,
        timeSec,
        args: a,
        snapEnabled,
        updateCreatePreview,
        applySegmentDraft,
      });
      if (!movedBefore && drag.moved) {
        interactionStateRef.current = markWaveformSegmentInteractionMoved(interactionStateRef.current);
      }
    },
    [applySegmentDraft, argsRef, updateCreatePreview],
  );

  const onPointerUp = useCallback(
    (ev: ReactPointerEvent<HTMLElement>) => {
      if (!dragRef.current || dragRef.current.pointerId !== ev.pointerId) return;
      finishDrag(ev);
    },
    [finishDrag],
  );

  /** Shared with the window-level fallback below — discards in-progress edit/lasso state. */
  const cancelActiveDrag = useCallback(
    (pointerId?: number) => {
      const drag = dragRef.current;
      if (!drag || (pointerId != null && drag.pointerId !== pointerId)) return;
      dragRef.current = null;
      interactionStateRef.current = cancelWaveformSegmentInteraction(interactionStateRef.current);
      suppressClickAfterPointer();
      updateCreatePreview(null);
      applySegmentDraft(null);
    },
    [applySegmentDraft, updateCreatePreview, suppressClickAfterPointer],
  );

  const onPointerCancel = useCallback(
    (ev: ReactPointerEvent<HTMLElement>) => {
      if (!dragRef.current || dragRef.current.pointerId !== ev.pointerId) return;
      releasePointerCaptureIfHeld(ev.currentTarget, ev.pointerId);
      cancelActiveDrag(ev.pointerId);
    },
    [cancelActiveDrag],
  );

  /**
   * Windows/WebView2 safety net: a window activation toggle or focus steal during
   * drag (documented WebView2 quirk, rare on WKWebView) can swallow the captured
   * element's pointerup/pointercancel entirely, leaving dragRef stuck and a ghost
   * draft/preview box on screen until the next unrelated pointerdown. `blur` fires
   * reliably regardless of whether the pointer event was delivered; `pointerup`/
   * `pointercancel` at window level are a second-layer net for the same target-miss
   * case. All three are idempotent no-ops once the normal element-level handler has
   * already cleared dragRef (bubbling means both may fire for a normal release).
   */
  useEffect(() => {
    const onWindowPointerEnd = (ev: PointerEvent) => cancelActiveDrag(ev.pointerId);
    const onWindowBlur = () => cancelActiveDrag();
    window.addEventListener("pointerup", onWindowPointerEnd);
    window.addEventListener("pointercancel", onWindowPointerEnd);
    window.addEventListener("blur", onWindowBlur);
    return () => {
      window.removeEventListener("pointerup", onWindowPointerEnd);
      window.removeEventListener("pointercancel", onWindowPointerEnd);
      window.removeEventListener("blur", onWindowBlur);
    };
  }, [cancelActiveDrag]);

  return {
    dragRef,
    interactionStateRef,
    suppressClickUntilRef,
    consumeLastSegmentTapGesture,
    suppressClickAfterPointer,
    onShellPointerDown,
    onSegmentPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
  };
}
