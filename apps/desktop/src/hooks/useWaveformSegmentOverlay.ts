import { useCallback, useLayoutEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type RefObject } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import { getSelectionChromeSnapshot } from "../services/selection/selectionChromeStore";
import { setCspLayoutRules } from "../utils/cspElementLayout";
import { applySegmentOverlayTap } from "../utils/waveformSegmentOverlayActions";
import { segmentOverlayGeometry } from "../utils/waveformSegmentBounds";
import {
  computeCreatePreviewStyle,
  resolveSegmentBoundsAt,
  type CreateRangePreview,
  type SegmentOverlayDraft,
} from "../utils/waveformSegmentOverlayGeometry";
import { useWaveformSegmentDrag } from "./useWaveformSegmentDrag";

function overlayRootFromCreatePreview(createPreviewRef: RefObject<HTMLElement | null>): ParentNode | null {
  return createPreviewRef.current?.closest(".waveform-segment-overlay") ?? null;
}

function applySegmentDraftOverlayImperative(
  draft: SegmentOverlayDraft,
  args: {
    timelineWidthPx: number;
    durationSec: number;
    layoutHeightPx: number;
    laneByIndex: number[];
    laneCount: number;
  },
  overlayRoot: ParentNode | null,
): void {
  const el = overlayRoot?.querySelector(`[data-segment-idx="${draft.idx}"]`) as HTMLElement | null;
  if (!el) return;
  const geom = segmentOverlayGeometry({
    startSec: draft.startSec,
    endSec: draft.endSec,
    timelineWidthPx: args.timelineWidthPx,
    durationSec: args.durationSec,
    lane: args.laneByIndex[draft.idx] ?? 0,
    laneCount: args.laneCount,
    containerHeightPx: args.layoutHeightPx,
  });
  setCspLayoutRules(el, {
    left: geom.leftPx,
    width: geom.widthPx,
    top: geom.topPx,
    height: geom.heightPx,
  });
}

export type { CreateRangePreview, SegmentOverlayDraft } from "../utils/waveformSegmentOverlayGeometry";

import type { SegmentOverlapPolicy } from "../utils/segmentTimeRange";

export function useWaveformSegmentOverlay(
  args: {
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
    suppressPlaybackFollowForSelectionSeek?: () => void;
    onDraftIdxChange?: (idx: number | null) => void;
    onClearMultiSelection?: () => void;
    isMultiSegmentSelection?: () => boolean;
  },
  createPreviewRef: RefObject<HTMLElement | null>,
) {
  const argsRef = useRef(args);
  argsRef.current = args;

  const [segmentDraft, setSegmentDraft] = useState<SegmentOverlayDraft | null>(null);

  const segmentDraftIdx = segmentDraft?.idx ?? null;
  const createPreviewInitializedRef = useRef(false);

  const bindCreatePreviewRef = useCallback(
    (el: HTMLElement | null) => {
      createPreviewRef.current = el;
      if (el && !createPreviewInitializedRef.current) {
        createPreviewInitializedRef.current = true;
        setCspLayoutRules(el, { display: "none" });
      }
    },
    [createPreviewRef],
  );

  const updateCreatePreview = useCallback(
    (preview: CreateRangePreview | null) => {
      const el = createPreviewRef.current;
      if (!el) return;
      if (!preview) {
        setCspLayoutRules(el, { display: "none" });
        return;
      }
      const a = argsRef.current;
      const layout = computeCreatePreviewStyle({
        createPreview: preview,
        timelineWidthPx: a.timelineWidthPx,
        durationSec: a.durationSec,
      });
      setCspLayoutRules(el, {
        display: "block",
        left: layout.left,
        width: layout.width,
      });
    },
    [createPreviewRef],
  );

  useLayoutEffect(() => {
    argsRef.current.onDraftIdxChange?.(segmentDraftIdx);
  }, [segmentDraftIdx]);

  const applySegmentDraft = useCallback(
    (draft: SegmentOverlayDraft | null) => {
      if (draft) {
        applySegmentDraftOverlayImperative(
          draft,
          argsRef.current,
          overlayRootFromCreatePreview(createPreviewRef),
        );
        setSegmentDraft(draft);
      } else {
        setSegmentDraft(null);
      }
    },
    [createPreviewRef],
  );

  const onSegmentPointerTap = useCallback((idx: number, pointerTimeSec: number) => {
    const a = argsRef.current;
    const seg = a.segments[idx];
    if (!seg) return;
    const chromePrimary = getSelectionChromeSnapshot().primaryIdx;
    applySegmentOverlayTap(
      {
        selectedIdx: chromePrimary >= 0 ? chromePrimary : a.selectedIdx,
        segmentIdx: idx,
        pointerTimeSec,
        segment: seg,
      },
      {
        onSelectSegmentAt: a.onSelectSegmentAt,
        seekToTime: a.seekToTime,
        suppressPlaybackFollowForSelectionSeek: a.suppressPlaybackFollowForSelectionSeek,
      },
    );
  }, []);

  const drag = useWaveformSegmentDrag(argsRef, applySegmentDraft, updateCreatePreview, onSegmentPointerTap);
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
    bindCreatePreviewRef,
  };
}
