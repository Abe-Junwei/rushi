import { useCallback, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import { segmentOverlayGeometry } from "../utils/waveformSegmentBounds";
import {
  resolveSegmentBoundsAt,
  type CreateRangePreview,
  type SegmentOverlayDraft,
} from "../utils/waveformSegmentOverlayGeometry";
import { useWaveformSegmentDrag } from "./useWaveformSegmentDrag";

export type { CreateRangePreview, SegmentOverlayDraft } from "../utils/waveformSegmentOverlayGeometry";

export function useWaveformSegmentOverlay(args: {
  disabled: boolean;
  segments: SegmentDto[];
  selectedIdx: number;
  pxPerSec: number;
  durationSec: number;
  layoutHeightPx: number;
  laneByIndex: number[];
  laneCount: number;
  enableCreateRange: boolean;
  clientXToTimeSec: (clientX: number) => number;
  onSelectSegmentAt: (idx: number) => void;
  onBeginBoundsEdit?: () => void;
  onFocusWaveformShell?: () => void;
  onBoundsCommit: (idx: number, startSec: number, endSec: number) => void;
  onCreateRange?: (startSec: number, endSec: number) => void;
  onPlaySegment?: (idx: number) => void;
  seekToTime: (timeSec: number) => void;
}) {
  const argsRef = useRef(args);
  argsRef.current = args;

  const [segmentDraft, setSegmentDraft] = useState<SegmentOverlayDraft | null>(null);
  const [createPreview, setCreatePreview] = useState<CreateRangePreview | null>(null);

  const applySegmentDraft = useCallback((draft: SegmentOverlayDraft | null) => {
    setSegmentDraft(draft);
  }, []);

  const drag = useWaveformSegmentDrag(argsRef, applySegmentDraft, setCreatePreview);
  const { suppressClickAfterPointer } = drag;

  const onSegmentClick = useCallback(
    (idx: number, ev: ReactMouseEvent<HTMLElement>) => {
      const a = argsRef.current;
      if (a.disabled || drag.dragRef.current || performance.now() < drag.suppressClickUntilRef.current) return;
      ev.stopPropagation();
      if (!a.segments[idx]) return;
      a.onFocusWaveformShell?.();
      a.onSelectSegmentAt(idx);
    },
    [drag.dragRef, drag.suppressClickUntilRef],
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
