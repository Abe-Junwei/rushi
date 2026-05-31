import { useCallback, useRef, type PointerEvent as ReactPointerEvent } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import {
  clampSegmentTimeBounds,
  hitSegmentEdgeFromTimelinePointer,
  resolveSegmentIndexAtWaveformPointer,
  selectPackableSegmentIndices,
  WAVEFORM_SEGMENT_MIN_SPAN_SEC,
} from "../utils/waveformSegmentBounds";
import {
  finalizeSegmentOverlayBounds,
  SEGMENT_BOUNDS_LIVE_MIN_SPAN_SEC,
} from "../utils/segmentGapPolicy";
import {
  isSegmentSnapEnabled,
  readSegmentOverlayModifiers,
  resolveCreateOverlapPolicy,
} from "../utils/segmentOverlayModifiers";
import {
  collectSegmentSnapTargets,
  resolveSnapThresholdSec,
  snapSegmentRange,
} from "../utils/segmentTimeSnap";
import type { SegmentOverlapPolicy } from "../utils/segmentTimeRange";
import { applyOverlayPointerUpIntent, type OverlayPointerActions } from "../utils/waveformSegmentOverlayActions";
import {
  boundsForOverlayDrag,
  type CreateRangePreview,
  type OverlayDragState,
  type SegmentOverlayDraft,
} from "../utils/waveformSegmentOverlayGeometry";
import { resolveOverlayPointerUpIntent } from "../utils/waveformSegmentOverlayGestures";

export const WAVEFORM_OVERLAY_SUPPRESS_CLICK_MS = 250;
/** Pointer move beyond this (px) counts as drag, not tap — stable across zoom levels. */
export const WAVEFORM_OVERLAY_DRAG_MOVE_THRESHOLD_PX = 4;

export type WaveformSegmentDragArgs = {
  disabled: boolean;
  segments: SegmentDto[];
  selectedIdx: number;
  timelineWidthPx: number;
  durationSec: number;
  getPlayheadSec?: () => number;
  layoutHeightPx: number;
  laneByIndex: number[];
  laneCount: number;
  enableCreateRange: boolean;
  clientXToTimeSec: (clientX: number) => number;
  onSelectSegmentAt: (idx: number) => void;
  onBeginBoundsEdit?: () => void;
  onFocusWaveformShell?: () => void;
  onBoundsCommit: (idx: number, startSec: number, endSec: number) => void;
  onCreateRange?: (
    startSec: number,
    endSec: number,
    options?: { overlapPolicy?: SegmentOverlapPolicy },
  ) => void;
  seekToTime: (timeSec: number) => void;
};

function overlayPointerActions(
  a: WaveformSegmentDragArgs,
  onSegmentPointerTap: (segmentIdx: number, pointerTimeSec: number) => void,
): OverlayPointerActions {
  return {
    onSegmentPointerTap,
    onBoundsCommit: a.onBoundsCommit,
    onCreateRange: a.onCreateRange,
    onFocusWaveformShell: a.onFocusWaveformShell,
    seekToTime: a.seekToTime,
  };
}

function snapTargetsForOverlay(
  a: WaveformSegmentDragArgs,
  excludeSegmentIndex?: number,
): { targets: number[]; thresholdSec: number } {
  const { packableIndices } = selectPackableSegmentIndices(a.segments, a.durationSec);
  const snapSegments = packableIndices
    .filter((i) => i !== excludeSegmentIndex)
    .map((i) => a.segments[i])
    .filter((s): s is SegmentDto => s != null);
  return {
    targets: collectSegmentSnapTargets({
      segments: snapSegments,
      durationSec: a.durationSec,
      playheadSec: a.getPlayheadSec?.(),
    }),
    thresholdSec: resolveSnapThresholdSec(a.timelineWidthPx, a.durationSec),
  };
}

function finalizeEditDragBounds(
  a: WaveformSegmentDragArgs,
  drag: OverlayDragState,
  bounds: { startSec: number; endSec: number },
  snapEnabled: boolean,
  minSpanSec: number,
): { startSec: number; endSec: number } | null {
  if (drag.mode === "create") return null;
  const { targets, thresholdSec } = snapTargetsForOverlay(a, drag.segmentIdx);
  const prev = a.segments[drag.segmentIdx - 1];
  const next = a.segments[drag.segmentIdx + 1];
  return finalizeSegmentOverlayBounds({
    bounds,
    mode: drag.mode,
    targets,
    thresholdSec,
    snapEnabled,
    durationSec: a.durationSec,
    neighbors: {
      prevEndSec: prev?.end_sec,
      nextStartSec: next?.start_sec,
    },
    minSpanSec,
  });
}

function snapCreateRange(
  a: WaveformSegmentDragArgs,
  lo: number,
  hi: number,
  snapEnabled: boolean,
): { startSec: number; endSec: number } {
  const { targets, thresholdSec } = snapTargetsForOverlay(a);
  const snapped = snapEnabled
    ? snapSegmentRange(lo, hi, targets, thresholdSec)
    : { startSec: lo, endSec: hi };
  return clampSegmentTimeBounds(snapped.startSec, snapped.endSec, a.durationSec || hi);
}

export function useWaveformSegmentDrag(
  argsRef: React.MutableRefObject<WaveformSegmentDragArgs>,
  applySegmentDraft: (draft: SegmentOverlayDraft | null) => void,
  setCreatePreview: React.Dispatch<React.SetStateAction<CreateRangePreview | null>>,
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

      if (drag.mode === "create") {
        const lo = Math.min(drag.initialStartSec, timeSec);
        const hi = Math.max(drag.initialStartSec, timeSec);
        setCreatePreview(null);
        const clamped = snapCreateRange(a, lo, hi, snapEnabled);
        const overlapPolicy = resolveCreateOverlapPolicy(modifiers);
        const intent = resolveOverlayPointerUpIntent({
          mode: drag.mode,
          moved: drag.moved,
          segmentIdx: drag.segmentIdx,
          pointerTimeSec: timeSec,
          anchorTimeSec: drag.anchorTimeSec,
          initialStartSec: drag.initialStartSec,
          initialEndSec: drag.initialEndSec,
          clampedStartSec: clamped.startSec,
          clampedEndSec: clamped.endSec,
        });
        applySegmentDraft(null);
        if (intent.kind === "create-range") {
          applyOverlayPointerUpIntent(
            { ...intent, overlapPolicy },
            overlayPointerActions(a, onSegmentPointerTapRef.current),
            suppressClickAfterPointer,
          );
          return;
        }
        applyOverlayPointerUpIntent(
          intent,
          overlayPointerActions(a, onSegmentPointerTapRef.current),
          suppressClickAfterPointer,
        );
        return;
      }

      let clamped = boundsForOverlayDrag(drag, timeSec, a.durationSec);
      applySegmentDraft(null);
      if (!clamped) return;

      const finalized = finalizeEditDragBounds(
        a,
        drag,
        clamped,
        snapEnabled,
        WAVEFORM_SEGMENT_MIN_SPAN_SEC,
      );
      if (!finalized) return;
      clamped = finalized;

      const intent = resolveOverlayPointerUpIntent({
        mode: drag.mode,
        moved: drag.moved,
        segmentIdx: drag.segmentIdx,
        pointerTimeSec: timeSec,
        anchorTimeSec: drag.anchorTimeSec,
        initialStartSec: drag.initialStartSec,
        initialEndSec: drag.initialEndSec,
        clampedStartSec: clamped.startSec,
        clampedEndSec: clamped.endSec,
      });
      applyOverlayPointerUpIntent(
        intent,
        overlayPointerActions(a, onSegmentPointerTapRef.current),
        suppressClickAfterPointer,
      );
    },
    [applySegmentDraft, argsRef, setCreatePreview, suppressClickAfterPointer],
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
      if ((ev.target as HTMLElement).closest("[data-waveform-segment]")) return;

      const timeSec = a.clientXToTimeSec(ev.clientX);
      const hitIdx = resolveSegmentIndexAtWaveformPointer({
        segments: a.segments,
        timeSec,
        pointerClientY: ev.clientY,
        overlayClientTop: ev.currentTarget.getBoundingClientRect().top,
        layoutHeightPx: a.layoutHeightPx,
        laneByIndex: a.laneByIndex,
        laneCount: a.laneCount,
        selectedIdx: a.selectedIdx,
        durationSec: a.durationSec,
      });
      if (hitIdx >= 0) {
        onSegmentPointerDown(hitIdx, ev);
        return;
      }

      if (a.enableCreateRange && a.onCreateRange) {
        // 锚点保持原始时间：纯点击空白处用于 seek（不吸附），框选范围在
        // move / finish 阶段由 snapCreateRange 对两端整体吸附。
        dragRef.current = {
          mode: "create",
          pointerId: ev.pointerId,
          segmentIdx: -1,
          anchorTimeSec: timeSec,
          anchorClientX: ev.clientX,
          initialStartSec: timeSec,
          initialEndSec: timeSec,
          moved: false,
        };
        setCreatePreview({ startSec: timeSec, endSec: timeSec });
        ev.currentTarget.setPointerCapture(ev.pointerId);
        return;
      }

      a.onFocusWaveformShell?.();
      a.seekToTime(timeSec);
    },
    [argsRef, onSegmentPointerDown, setCreatePreview],
  );

  const onPointerMove = useCallback(
    (ev: ReactPointerEvent<HTMLElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== ev.pointerId) return;
      const a = argsRef.current;
      const snapEnabled = isSegmentSnapEnabled(readSegmentOverlayModifiers(ev));
      const timeSec = a.clientXToTimeSec(ev.clientX);

      if (drag.mode === "create") {
        const lo = Math.min(drag.initialStartSec, timeSec);
        const hi = Math.max(drag.initialStartSec, timeSec);
        if (Math.abs(ev.clientX - drag.anchorClientX) > WAVEFORM_OVERLAY_DRAG_MOVE_THRESHOLD_PX) {
          drag.moved = true;
        }
        const clamped = snapCreateRange(a, lo, hi, snapEnabled);
        setCreatePreview({ startSec: clamped.startSec, endSec: clamped.endSec });
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
      applySegmentDraft({ idx: drag.segmentIdx, ...clamped });
    },
    [applySegmentDraft, argsRef, setCreatePreview],
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
      setCreatePreview(null);
      applySegmentDraft(null);

      if (drag.mode === "create") {
        if (!drag.moved) {
          suppressClickAfterPointer();
          a.onFocusWaveformShell?.();
          a.seekToTime(drag.anchorTimeSec);
        }
        return;
      }

      if (!drag.moved) {
        suppressClickAfterPointer();
        a.onFocusWaveformShell?.();
        onSegmentPointerTapRef.current(drag.segmentIdx, drag.anchorTimeSec);
      }
    },
    [applySegmentDraft, argsRef, setCreatePreview, suppressClickAfterPointer],
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
