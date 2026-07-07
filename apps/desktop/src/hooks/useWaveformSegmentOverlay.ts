import { useCallback, useLayoutEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type RefObject } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import { selectionChromeEffectivePrimaryIdx } from "../services/selection/selectionChromeStore";
import { setCspLayoutRules } from "../utils/cspElementLayout";
import { applySegmentOverlayTap, type SegmentOverlayTapGesture } from "../utils/waveformSegmentOverlayActions";
import type { WaveformSelectionGesture } from "../services/waveform/waveformSelectionGesture";
import { segmentOverlayGeometry } from "../utils/waveformSegmentBounds";
import {
  computeCreatePreviewStyle,
  resolveSegmentBoundsAt,
  type CreateRangePreview,
  type SegmentOverlayDraft,
} from "../utils/waveformSegmentOverlayGeometry";
import {
  applySegmentDraftOverlayImperative,
  applySegmentDraftPreviewFallback,
  clearSegmentDraftOverlayLayout,
  hidePreviewFallback,
  hideSegmentDraftPreviewFallbackIfOverlayMounted,
  overlayRootFromCreatePreview,
} from "../utils/waveformSegmentOverlayDraftChrome";
import { resolveWaveformSelectionRenderProjection } from "../services/waveform/waveformSelectionRenderProjection";
import { useWaveformSegmentDrag } from "./useWaveformSegmentDrag";

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
    onWaveformSelectionGesture?: (gesture: WaveformSelectionGesture) => boolean | void;
    /** @deprecated 使用 onWaveformSelectionGesture down phase */
    onPreviewSegmentSelect?: (idx: number) => boolean;
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
    onPlaySegment?: (idx: number, fromSec?: number) => void;
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
  const activeDraftIdxRef = useRef<number | null>(null);

  const segmentDraftIdx = segmentDraft?.idx ?? null;
  const createPreviewInitializedRef = useRef(false);
  const lastCreatePreviewLayoutRef = useRef<{ left: number; width: number } | null>(null);
  const createPreviewPendingRef = useRef<CreateRangePreview | null>(null);
  const createPreviewRafRef = useRef(0);

  const applyCreatePreviewLayout = useCallback(
    (preview: CreateRangePreview | null) => {
      const el = createPreviewRef.current;
      if (!el) return;
      if (!preview) {
        lastCreatePreviewLayoutRef.current = null;
        setCspLayoutRules(el, { display: "none" });
        return;
      }
      const a = argsRef.current;
      const layout = computeCreatePreviewStyle({
        createPreview: preview,
        timelineWidthPx: a.timelineWidthPx,
        durationSec: a.durationSec,
      });
      const last = lastCreatePreviewLayoutRef.current;
      if (last && last.left === layout.left && last.width === layout.width) {
        return;
      }
      lastCreatePreviewLayoutRef.current = layout;
      setCspLayoutRules(el, {
        display: "block",
        left: layout.left,
        width: layout.width,
      });
    },
    [createPreviewRef],
  );

  const flushCreatePreviewRaf = useCallback(() => {
    createPreviewRafRef.current = 0;
    const preview = createPreviewPendingRef.current;
    if (preview === null) return;
    applyCreatePreviewLayout(preview);
  }, [applyCreatePreviewLayout]);

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
      if (!preview) {
        createPreviewPendingRef.current = null;
        if (createPreviewRafRef.current) {
          window.cancelAnimationFrame(createPreviewRafRef.current);
          createPreviewRafRef.current = 0;
        }
        applyCreatePreviewLayout(null);
        return;
      }
      createPreviewPendingRef.current = preview;
      if (createPreviewRafRef.current) return;
      createPreviewRafRef.current = window.requestAnimationFrame(flushCreatePreviewRaf);
    },
    [applyCreatePreviewLayout, flushCreatePreviewRaf],
  );

  useLayoutEffect(() => {
    argsRef.current.onDraftIdxChange?.(segmentDraftIdx);
  }, [segmentDraftIdx]);

  useLayoutEffect(() => {
    hideSegmentDraftPreviewFallbackIfOverlayMounted(createPreviewRef.current, segmentDraftIdx);
  }, [createPreviewRef, segmentDraftIdx]);

  const applySegmentDraft = useCallback(
    (draft: SegmentOverlayDraft | null) => {
      const overlayRoot = overlayRootFromCreatePreview(createPreviewRef);
      if (draft) {
        if (activeDraftIdxRef.current != null && activeDraftIdxRef.current !== draft.idx) {
          clearSegmentDraftOverlayLayout(activeDraftIdxRef.current, overlayRoot);
        }
        activeDraftIdxRef.current = draft.idx;
        const appliedExistingOverlay = applySegmentDraftOverlayImperative(
          draft,
          argsRef.current,
          overlayRoot,
        );
        if (appliedExistingOverlay) {
          hidePreviewFallback(createPreviewRef.current);
        } else if (
          resolveWaveformSelectionRenderProjection({
            segmentCount: argsRef.current.segments.length,
            selectedIdx: argsRef.current.selectedIdx,
            selectionLo: argsRef.current.selectionLo,
            selectionHi: argsRef.current.selectionHi,
            draftIdx: draft.idx,
            overlayRoot,
          }).fallbackTargetIdx === draft.idx
        ) {
          applySegmentDraftPreviewFallback(draft, argsRef.current, createPreviewRef.current);
        } else {
          hidePreviewFallback(createPreviewRef.current);
        }
        setSegmentDraft(draft);
      } else {
        clearSegmentDraftOverlayLayout(activeDraftIdxRef.current, overlayRoot);
        activeDraftIdxRef.current = null;
        hidePreviewFallback(createPreviewRef.current);
        setSegmentDraft(null);
      }
    },
    [createPreviewRef],
  );

  const onSegmentPointerTap = useCallback(
    (idx: number, pointerTimeSec: number, tapGesture?: SegmentOverlayTapGesture) => {
      const a = argsRef.current;
      const seg = a.segments[idx];
      if (!seg) return;
      if (a.onWaveformSelectionGesture) {
        a.onWaveformSelectionGesture({
          phase: "up",
          idx,
          pointerTimeSec,
          selectedIdxAtPointerDown:
            tapGesture?.selectedIdxAtPointerDown ??
            selectionChromeEffectivePrimaryIdx(a.selectedIdx),
          viewportSyncedOnDown: tapGesture?.viewportSyncedOnDown,
          sessionId: tapGesture?.sessionId,
        });
        return;
      }
      applySegmentOverlayTap(
        {
          selectedIdx: a.selectedIdx,
          selectedIdxAtPointerDown: tapGesture?.selectedIdxAtPointerDown,
          viewportSyncedOnDown: tapGesture?.viewportSyncedOnDown,
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
    },
    [],
  );

  const drag = useWaveformSegmentDrag(argsRef, applySegmentDraft, updateCreatePreview, onSegmentPointerTap);
  const {
    consumeLastSegmentTapGesture,
    dragRef,
    suppressClickAfterPointer,
    suppressClickUntilRef,
  } = drag;

  const onSegmentClick = useCallback(
    (idx: number, ev: ReactMouseEvent<HTMLElement>) => {
      const a = argsRef.current;
      if (a.disabled || dragRef.current || performance.now() < suppressClickUntilRef.current) return;
      ev.stopPropagation();
      if (!a.segments[idx]) return;
      if (ev.shiftKey) {
        a.onSelectSegmentAt(idx, { shiftKey: true });
        return;
      }
      if (ev.metaKey || ev.ctrlKey) {
        a.onSelectSegmentAt(idx, { toggle: true });
        return;
      }
      onSegmentPointerTap(
        idx,
        a.clientXToTimeSec(ev.clientX),
        consumeLastSegmentTapGesture(idx) ?? {
          selectedIdxAtPointerDown: selectionChromeEffectivePrimaryIdx(a.selectedIdx),
        },
      );
    },
    [consumeLastSegmentTapGesture, dragRef, suppressClickUntilRef, onSegmentPointerTap],
  );

  const onSegmentDoubleClick = useCallback(
    (idx: number, ev: ReactMouseEvent<HTMLElement>) => {
      const a = argsRef.current;
      if (a.disabled) return;
      ev.stopPropagation();
      if (!a.segments[idx]) return;
      suppressClickAfterPointer();
      const effectiveSelectedIdx = selectionChromeEffectivePrimaryIdx(a.selectedIdx);
      if (effectiveSelectedIdx !== idx) {
        a.onSelectSegmentAt(idx);
      } else {
        a.onFocusWaveformShell?.();
      }
      void a.onPlaySegment?.(idx, a.clientXToTimeSec(ev.clientX));
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
