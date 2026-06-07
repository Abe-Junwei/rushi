import { useCallback, useLayoutEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import { applySegmentOverlayTap } from "../utils/waveformSegmentOverlayActions";
import { segmentOverlayGeometry } from "../utils/waveformSegmentBounds";
import {
  resolveSegmentBoundsAt,
  type CreateRangePreview,
  type SegmentOverlayDraft,
} from "../utils/waveformSegmentOverlayGeometry";
import { useWaveformSegmentDrag } from "./useWaveformSegmentDrag";

export type { CreateRangePreview, SegmentOverlayDraft } from "../utils/waveformSegmentOverlayGeometry";

import type { SegmentOverlapPolicy } from "../utils/segmentTimeRange";

export function useWaveformSegmentOverlay(args: {
  disabled: boolean;
  segments: SegmentDto[];
  selectedIdx: number;
  selectionLo?: number;
  selectionHi?: number;
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
    options?: { overlapPolicy?: SegmentOverlapPolicy },
  ) => void;
  onSelectTimeRange?: (startSec: number, endSec: number) => void;
  onPlaySegment?: (idx: number) => void;
  seekToTime: (timeSec: number) => void;
  onDraftIdxChange?: (idx: number | null) => void;
  revealSelectedSegmentInViewport?: () => void;
}) {
  const argsRef = useRef(args);
  argsRef.current = args;

  const [segmentDraft, setSegmentDraft] = useState<SegmentOverlayDraft | null>(null);
  const [createPreview, setCreatePreview] = useState<CreateRangePreview | null>(null);

  const segmentDraftIdx = segmentDraft?.idx ?? null;

  useLayoutEffect(() => {
    argsRef.current.onDraftIdxChange?.(segmentDraftIdx);
  }, [segmentDraftIdx]);

  const applySegmentDraft = useCallback((draft: SegmentOverlayDraft | null) => {
    setSegmentDraft(draft);
  }, []);

  const onSegmentPointerTap = useCallback((idx: number, pointerTimeSec: number) => {
    const a = argsRef.current;
    const seg = a.segments[idx];
    if (!seg) return;
    applySegmentOverlayTap(
      {
        selectedIdx: a.selectedIdx,
        segmentIdx: idx,
        pointerTimeSec,
        segment: seg,
      },
      { onSelectSegmentAt: a.onSelectSegmentAt, seekToTime: a.seekToTime, revealSelectedSegmentInViewport: a.revealSelectedSegmentInViewport },
    );
  }, []);

  const drag = useWaveformSegmentDrag(argsRef, applySegmentDraft, setCreatePreview, onSegmentPointerTap);
  const { suppressClickAfterPointer } = drag;

  const onSegmentClick = useCallback(
    (idx: number, ev: ReactMouseEvent<HTMLElement>) => {
      const a = argsRef.current;
      if (a.disabled || drag.dragRef.current || performance.now() < drag.suppressClickUntilRef.current) return;
      ev.stopPropagation();
      if (!a.segments[idx]) return;
      a.onFocusWaveformShell?.();
      if (ev.shiftKey) {
        a.onSelectSegmentAt(idx, { shiftKey: true });
        return;
      }
      if (ev.metaKey || ev.ctrlKey) {
        a.onSelectSegmentAt(idx, { toggle: true });
        return;
      }
      onSegmentPointerTap(idx, a.clientXToTimeSec(ev.clientX));
    },
    [drag.dragRef, drag.suppressClickUntilRef, onSegmentPointerTap],
  );

  const onSegmentDoubleClick = useCallback(
    (idx: number, ev: ReactMouseEvent<HTMLElement>) => {
      const a = argsRef.current;
      if (a.disabled) return;
      ev.stopPropagation();
      if (!a.segments[idx]) return;
      suppressClickAfterPointer();
      a.onFocusWaveformShell?.();
      a.onSelectSegmentAt(idx);
      void a.onPlaySegment?.(idx);
    },
    [suppressClickAfterPointer],
  );

  const segmentBoundsAt = useCallback(
    (idx: number) => resolveSegmentBoundsAt(idx, args.segments, segmentDraft),
    [args.segments, segmentDraft],
  );

  return {
    createPreview,
    segmentDraftIdx,
    segmentBoundsAt,
    onShellPointerDown: drag.onShellPointerDown,
    onSegmentPointerDown: drag.onSegmentPointerDown,
    onSegmentClick,
    onSegmentDoubleClick,
    onPointerMove: drag.onPointerMove,
    onPointerUp: drag.onPointerUp,
    onPointerCancel: drag.onPointerCancel,
    segmentOverlayGeometry,
  };
}
