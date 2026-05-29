import { useCallback, useRef, type PointerEvent as ReactPointerEvent } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import { clampSegmentTimeBounds, hitSegmentEdgeFromTimelinePointer } from "../utils/waveformSegmentBounds";
import { applyOverlayPointerUpIntent } from "../utils/waveformSegmentOverlayActions";
import {
  boundsForOverlayDrag,
  type CreateRangePreview,
  type OverlayDragState,
  type SegmentOverlayDraft,
} from "../utils/waveformSegmentOverlayGeometry";
import { resolveOverlayPointerUpIntent } from "../utils/waveformSegmentOverlayGestures";

export const WAVEFORM_OVERLAY_SUPPRESS_CLICK_MS = 250;
const SEGMENT_TAP_MAX_DELTA_SEC = 0.02;

export type WaveformSegmentDragArgs = {
  disabled: boolean;
  segments: SegmentDto[];
  pxPerSec: number;
  durationSec: number;
  enableCreateRange: boolean;
  clientXToTimeSec: (clientX: number) => number;
  onSelectSegmentAt: (idx: number) => void;
  onBeginBoundsEdit?: () => void;
  onFocusWaveformShell?: () => void;
  onBoundsCommit: (idx: number, startSec: number, endSec: number) => void;
  onCreateRange?: (startSec: number, endSec: number) => void;
  seekToTime: (timeSec: number) => void;
};

export function useWaveformSegmentDrag(
  argsRef: React.MutableRefObject<WaveformSegmentDragArgs>,
  applySegmentDraft: (draft: SegmentOverlayDraft | null) => void,
  setCreatePreview: React.Dispatch<React.SetStateAction<CreateRangePreview | null>>,
) {
  const dragRef = useRef<OverlayDragState | null>(null);
  const suppressClickUntilRef = useRef(0);

  const suppressClickAfterPointer = useCallback(() => {
    suppressClickUntilRef.current = performance.now() + WAVEFORM_OVERLAY_SUPPRESS_CLICK_MS;
  }, []);

  const finishDrag = useCallback(
    (ev: ReactPointerEvent<HTMLElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== ev.pointerId) return;
      dragRef.current = null;
      const a = argsRef.current;
      const timeSec = a.clientXToTimeSec(ev.clientX);

      if (drag.mode === "create") {
        const lo = Math.min(drag.initialStartSec, timeSec);
        const hi = Math.max(drag.initialStartSec, timeSec);
        setCreatePreview(null);
        const clamped = clampSegmentTimeBounds(lo, hi, a.durationSec || hi);
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
        applyOverlayPointerUpIntent(
          intent,
          {
            onSelectSegmentAt: a.onSelectSegmentAt,
            onBoundsCommit: a.onBoundsCommit,
            onCreateRange: a.onCreateRange,
            onFocusWaveformShell: a.onFocusWaveformShell,
            seekToTime: a.seekToTime,
          },
          suppressClickAfterPointer,
        );
        return;
      }

      const clamped = boundsForOverlayDrag(drag, timeSec, a.durationSec);
      applySegmentDraft(null);
      if (!clamped) return;

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
        {
          onSelectSegmentAt: a.onSelectSegmentAt,
          onBoundsCommit: a.onBoundsCommit,
          onCreateRange: a.onCreateRange,
          onFocusWaveformShell: a.onFocusWaveformShell,
          seekToTime: a.seekToTime,
        },
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
        pxPerSec: a.pxPerSec,
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
      if (a.enableCreateRange && a.onCreateRange) {
        dragRef.current = {
          mode: "create",
          pointerId: ev.pointerId,
          segmentIdx: -1,
          anchorTimeSec: timeSec,
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
    [argsRef, setCreatePreview],
  );

  const onPointerMove = useCallback(
    (ev: ReactPointerEvent<HTMLElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== ev.pointerId) return;
      const a = argsRef.current;
      const timeSec = a.clientXToTimeSec(ev.clientX);

      if (drag.mode === "create") {
        const lo = Math.min(drag.initialStartSec, timeSec);
        const hi = Math.max(drag.initialStartSec, timeSec);
        if (Math.abs(timeSec - drag.anchorTimeSec) > SEGMENT_TAP_MAX_DELTA_SEC) {
          drag.moved = true;
        }
        setCreatePreview({ startSec: lo, endSec: hi });
        return;
      }

      if (Math.abs(timeSec - drag.anchorTimeSec) > SEGMENT_TAP_MAX_DELTA_SEC) {
        drag.moved = true;
      }
      const clamped = boundsForOverlayDrag(drag, timeSec, a.durationSec);
      if (!clamped) return;
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
        a.onSelectSegmentAt(drag.segmentIdx);
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
