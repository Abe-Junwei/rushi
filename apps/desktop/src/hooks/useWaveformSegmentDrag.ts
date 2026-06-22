import { useCallback, useRef, type PointerEvent as ReactPointerEvent } from "react";
import {
  hitSegmentEdgeFromTimelinePointer,
  resolveSegmentIndexAtWaveformPointer,
} from "../utils/waveformSegmentBounds";
import { getSelectionChromeSnapshot } from "../services/selection/selectionChromeStore";
import {
  isSegmentSnapEnabled,
  readSegmentOverlayModifiers,
} from "../utils/segmentOverlayModifiers";
import type { CreateRangePreview, OverlayDragState, SegmentOverlayDraft } from "../utils/waveformSegmentOverlayGeometry";
import {
  resolveBlankOverlayShellDragMode,
} from "../utils/waveformSegmentOverlayGestures";
import {
  finalizeEditDragBounds,
  finishWaveformEditDrag,
  finishWaveformLassoDrag,
  SEGMENT_BOUNDS_LIVE_MIN_SPAN_SEC,
  snapCreateRange,
} from "./waveformSegmentDragHelpers";
import { boundsForOverlayDrag } from "../utils/waveformSegmentOverlayGeometry";

const WAVEFORM_OVERLAY_SUPPRESS_CLICK_MS = 250;
/** Pointer move beyond this (px) counts as drag, not tap — stable across zoom levels. */
const WAVEFORM_OVERLAY_DRAG_MOVE_THRESHOLD_PX = 4;

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
  onSelectSegmentIndices?: (indices: number[], primaryIdx: number) => void;
  getSelectedIndices?: () => ReadonlySet<number>;
  onBeginBoundsEdit?: () => void;
  onFocusWaveformShell?: () => void;
  onBoundsCommit: (idx: number, startSec: number, endSec: number) => void;
  onCreateRange?: (
    startSec: number,
    endSec: number,
    options?: { overlapPolicy?: import("../utils/segmentTimeRange").SegmentOverlapPolicy },
  ) => void;
  onSelectTimeRange?: (startSec: number, endSec: number) => void;
  seekToTime: (timeSec: number) => void;
  suppressPlaybackFollowForSelectionSeek?: () => void;
  onClearMultiSelection?: () => void;
  isMultiSegmentSelection?: () => boolean;
};

export function useWaveformSegmentDrag(
  argsRef: React.MutableRefObject<WaveformSegmentDragArgs>,
  applySegmentDraft: (draft: SegmentOverlayDraft | null) => void,
  updateCreatePreview: (preview: CreateRangePreview | null) => void,
  onSegmentPointerTap: (segmentIdx: number, pointerTimeSec: number) => void,
) {
  const dragRef = useRef<OverlayDragState | null>(null);
  const suppressClickUntilRef = useRef(0);
  const onSegmentPointerTapRef = useRef(onSegmentPointerTap);
  onSegmentPointerTapRef.current = onSegmentPointerTap;

  const suppressClickAfterPointer = useCallback(() => {
    suppressClickUntilRef.current = performance.now() + WAVEFORM_OVERLAY_SUPPRESS_CLICK_MS;
  }, []);

  const finishDrag = useCallback(
    (ev: ReactPointerEvent<HTMLElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== ev.pointerId) return;
      dragRef.current = null;
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
          args: a,
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
      const seg = a.segments[idx];
      if (!seg) return;
      ev.stopPropagation();
      const mode = hitSegmentEdgeFromTimelinePointer({
        pointerTimeSec: a.clientXToTimeSec(ev.clientX),
        startSec: seg.start_sec,
        endSec: seg.end_sec,
        timelineWidthPx: a.timelineWidthPx,
        durationSec: a.durationSec,
      });
      if (mode !== "move") {
        ev.preventDefault();
      }
      if (mode === "resize-start" || mode === "resize-end" || mode === "move") {
        a.onBeginBoundsEdit?.();
      }
      dragRef.current = {
        mode,
        pointerId: ev.pointerId,
        segmentIdx: idx,
        anchorTimeSec: a.clientXToTimeSec(ev.clientX),
        anchorClientX: ev.clientX,
        initialStartSec: seg.start_sec,
        initialEndSec: seg.end_sec,
        moved: false,
      };
      applySegmentDraft({ idx, startSec: seg.start_sec, endSec: seg.end_sec });
      ev.currentTarget.setPointerCapture(ev.pointerId);
    },
    [applySegmentDraft, argsRef],
  );

  const onShellPointerDown = useCallback(
    (ev: ReactPointerEvent<HTMLElement>) => {
      const a = argsRef.current;
      if (a.disabled || ev.button !== 0) return;

      const timeSec = a.clientXToTimeSec(ev.clientX);
      const chromePrimary = getSelectionChromeSnapshot().primaryIdx;
      const hitIdx = resolveSegmentIndexAtWaveformPointer({
        segments: a.segments,
        timeSec,
        pointerClientY: ev.clientY,
        overlayClientTop: ev.currentTarget.getBoundingClientRect().top,
        layoutHeightPx: a.layoutHeightPx,
        laneByIndex: a.laneByIndex,
        laneCount: a.laneCount,
        selectedIdx: chromePrimary >= 0 ? chromePrimary : a.selectedIdx,
        durationSec: a.durationSec,
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
        dragRef.current = {
          mode: "lasso",
          pointerId: ev.pointerId,
          segmentIdx: -1,
          anchorTimeSec: timeSec,
          anchorClientX: ev.clientX,
          initialStartSec: timeSec,
          initialEndSec: timeSec,
          moved: false,
          blankLasso: true,
          baseIndices,
        };
        if (!modifiers.shiftKey && !modifiers.toggleKey) {
          a.onFocusWaveformShell?.();
          a.suppressPlaybackFollowForSelectionSeek?.();
          a.seekToTime(timeSec);
        }
        ev.currentTarget.setPointerCapture(ev.pointerId);
        return;
      }

      a.onFocusWaveformShell?.();
      a.suppressPlaybackFollowForSelectionSeek?.();
      a.seekToTime(timeSec);
    },
    [argsRef, onSegmentPointerDown, updateCreatePreview],
  );

  const onPointerMove = useCallback(
    (ev: ReactPointerEvent<HTMLElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== ev.pointerId) return;
      const a = argsRef.current;
      const snapEnabled = isSegmentSnapEnabled(readSegmentOverlayModifiers(ev));
      const timeSec = a.clientXToTimeSec(ev.clientX);

      if (drag.mode === "lasso") {
        if (Math.abs(ev.clientX - drag.anchorClientX) > WAVEFORM_OVERLAY_DRAG_MOVE_THRESHOLD_PX) {
          drag.moved = true;
        }
        if (!drag.moved) return;
        const lo = Math.min(drag.initialStartSec, timeSec);
        const hi = Math.max(drag.initialStartSec, timeSec);
        const clamped = snapCreateRange(a, lo, hi, snapEnabled);
        updateCreatePreview({ startSec: clamped.startSec, endSec: clamped.endSec });
        return;
      }

      if (Math.abs(ev.clientX - drag.anchorClientX) > WAVEFORM_OVERLAY_DRAG_MOVE_THRESHOLD_PX) {
        drag.moved = true;
      }
      let clamped = boundsForOverlayDrag(drag, timeSec, a.durationSec);
      if (!clamped) return;
      clamped =
        finalizeEditDragBounds(
          a,
          drag,
          clamped,
          snapEnabled,
          SEGMENT_BOUNDS_LIVE_MIN_SPAN_SEC,
        ) ?? clamped;
      drag.lastFinalizedBounds = clamped;
      applySegmentDraft({ idx: drag.segmentIdx, ...clamped });
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

  const onPointerCancel = useCallback(
    (ev: ReactPointerEvent<HTMLElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== ev.pointerId) return;
      dragRef.current = null;
      try {
        (ev.currentTarget).releasePointerCapture(ev.pointerId);
      } catch {
        /* noop */
      }
      const a = argsRef.current;
      updateCreatePreview(null);
      applySegmentDraft(null);

      if (drag.mode === "lasso") {
        if (!drag.moved) {
          const modifiers = readSegmentOverlayModifiers(ev);
          finishWaveformLassoDrag({
            drag,
            timeSec: a.clientXToTimeSec(ev.clientX),
            args: a,
            snapEnabled: isSegmentSnapEnabled(modifiers),
            modifiers,
            suppressClickAfterPointer,
          });
        }
        return;
      }

      if (!drag.moved) {
        suppressClickAfterPointer();
        a.onFocusWaveformShell?.();
        if (ev.shiftKey) {
          a.onSelectSegmentAt(drag.segmentIdx, { shiftKey: true });
        } else if (ev.metaKey || ev.ctrlKey) {
          a.onSelectSegmentAt(drag.segmentIdx, { toggle: true });
        } else {
          onSegmentPointerTapRef.current(drag.segmentIdx, drag.anchorTimeSec);
        }
      }
    },
    [applySegmentDraft, argsRef, updateCreatePreview, suppressClickAfterPointer],
  );

  return {
    dragRef,
    suppressClickUntilRef,
    suppressClickAfterPointer,
    onShellPointerDown,
    onSegmentPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
  };
}
