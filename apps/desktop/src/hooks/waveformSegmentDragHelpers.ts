import type { SegmentDto } from "../tauri/projectApi";
import {
  clampSegmentTimeBounds,
  selectPackableSegmentIndices,
  selectPackableSegments,
  WAVEFORM_SEGMENT_MIN_SPAN_SEC,
} from "../utils/waveformSegmentBounds";
import {
  finalizeSegmentOverlayBoundsEat,
  SEGMENT_BOUNDS_LIVE_MIN_SPAN_SEC,
  type ResizeEatResult,
} from "../utils/segmentGapPolicy";
import { resolveCreateOverlapPolicy, type SegmentOverlayPointerModifiers } from "../utils/segmentOverlayModifiers";
import { resolveCreateRangeForPolicy } from "../utils/segmentTimeRange";
import {
  collectSegmentSnapTargets,
  resolveSnapThresholdSec,
  snapSegmentRange,
} from "../utils/segmentTimeSnap";
import {
  applyOverlayPointerUpIntent,
  type OverlayPointerActions,
  type SegmentOverlayTapGesture,
} from "../utils/waveformSegmentOverlayActions";
import {
  boundsForOverlayDrag,
  type CreateRangePreview,
  type OverlayDragState,
  type SegmentOverlayDraft,
} from "../utils/waveformSegmentOverlayGeometry";
import { resolveOverlayPointerUpIntent } from "../utils/waveformSegmentOverlayGestures";
import { pointerMovedPastWaveformDragThreshold } from "../utils/waveformSegmentDragSession";
import { computeSegmentLassoOutcome } from "../utils/segmentSelection";
import type { WaveformSegmentDragArgs } from "./useWaveformSegmentDrag";

function overlayPointerActions(
  a: WaveformSegmentDragArgs,
  onSegmentPointerTap: (
    segmentIdx: number,
    pointerTimeSec: number,
    tapGesture?: SegmentOverlayTapGesture,
  ) => void,
): OverlayPointerActions {
  return {
    onSegmentPointerTap,
    onBoundsCommit: a.onBoundsCommit,
    onCreateRange: a.onCreateRange,
    onSelectTimeRange: a.onSelectTimeRange,
    onFocusWaveformShell: a.onFocusWaveformShell,
    seekToTime: a.seekBlankToTime ?? a.seekToTime,
    suppressPlaybackFollowForSelectionSeek: a.suppressPlaybackFollowForSelectionSeek,
  };
}

function seekBlankToTime(a: WaveformSegmentDragArgs, timeSec: number): void {
  (a.seekBlankToTime ?? a.seekToTime)(timeSec);
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

export function finalizeEditDragBounds(
  a: WaveformSegmentDragArgs,
  drag: OverlayDragState,
  bounds: { startSec: number; endSec: number },
  snapEnabled: boolean,
  minSpanSec: number,
): ResizeEatResult | null {
  if (drag.mode === "lasso") return null;
  const { targets, thresholdSec } = snapTargetsForOverlay(a, drag.segmentIdx);
  return finalizeSegmentOverlayBoundsEat({
    bounds,
    mode: drag.mode,
    activeIdx: drag.segmentIdx,
    segments: a.segments,
    targets,
    thresholdSec,
    snapEnabled,
    durationSec: a.durationSec,
    minSpanSec,
  });
}

export function snapCreateRange(
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

export function finishWaveformLassoDrag(input: {
  drag: OverlayDragState;
  timeSec: number;
  args: WaveformSegmentDragArgs;
  snapEnabled: boolean;
  modifiers: SegmentOverlayPointerModifiers;
  suppressClickAfterPointer: () => void;
}): boolean {
  const { drag, timeSec, args: a, snapEnabled, modifiers, suppressClickAfterPointer } = input;
  const lo = Math.min(drag.initialStartSec, timeSec);
  const hi = Math.max(drag.initialStartSec, timeSec);

  if (!drag.moved) {
    suppressClickAfterPointer();
    a.onFocusWaveformShell?.();
    if (modifiers.shiftKey || modifiers.toggleKey) {
      return true;
    }
    if (a.isMultiSegmentSelection?.()) {
      a.onClearMultiSelection?.();
    } else if (!drag.blankSeekedOnDown) {
      // pointerdown already seekBlankToTime for non-modifier lasso — avoid double gen/seek.
      seekBlankToTime(a, drag.anchorTimeSec);
    }
    return true;
  }

  const baseIndices = drag.baseIndices ?? new Set<number>();
  const overlapPolicy = resolveCreateOverlapPolicy(modifiers);

  const outcome = computeSegmentLassoOutcome(
    a.segments,
    lo,
    hi,
    a.durationSec,
    baseIndices,
    a.listVisibleIndexSet ?? null,
  );
  if (outcome.mode === "select" && outcome.indices.size > 0) {
    suppressClickAfterPointer();
    a.onSelectSegmentIndices?.(
      [...outcome.indices].sort((x, y) => x - y),
      outcome.primaryIdx >= 0 ? outcome.primaryIdx : Math.min(...outcome.indices),
    );
    return true;
  }

  if (Math.abs(hi - lo) >= WAVEFORM_SEGMENT_MIN_SPAN_SEC) {
    const clamped = snapCreateRange(a, lo, hi, snapEnabled);
    if (drag.blankLasso && !modifiers.shiftKey && !modifiers.toggleKey) {
      const overlapSegs = selectPackableSegments(a.segments, a.durationSec);
      const fit = resolveCreateRangeForPolicy(
        overlapSegs,
        clamped.startSec,
        clamped.endSec,
        overlapPolicy,
      );
      if (fit) {
        suppressClickAfterPointer();
        a.onCreateRange?.(fit.startSec, fit.endSec, { overlapPolicy });
        return true;
      }
    } else {
      suppressClickAfterPointer();
      a.onCreateRange?.(clamped.startSec, clamped.endSec, { overlapPolicy });
      return true;
    }
  }

  suppressClickAfterPointer();
  a.onFocusWaveformShell?.();
  if (a.isMultiSegmentSelection?.()) {
    a.onClearMultiSelection?.();
  } else {
    seekBlankToTime(a, timeSec);
  }
  return true;
}

export function finishWaveformEditDrag(input: {
  drag: OverlayDragState;
  timeSec: number;
  args: WaveformSegmentDragArgs;
  snapEnabled: boolean;
  ev: Pick<React.PointerEvent, "shiftKey" | "metaKey" | "ctrlKey">;
  onSegmentPointerTap: (
    segmentIdx: number,
    pointerTimeSec: number,
    tapGesture?: SegmentOverlayTapGesture,
  ) => void;
  suppressClickAfterPointer: () => void;
}): void {
  const { drag, timeSec, args: a, snapEnabled, ev, onSegmentPointerTap, suppressClickAfterPointer } = input;

  let clamped = drag.lastFinalizedBounds ?? boundsForOverlayDrag(drag, timeSec, a.durationSec);
  if (!clamped) return;

  const eat = finalizeEditDragBounds(a, drag, clamped, snapEnabled, WAVEFORM_SEGMENT_MIN_SPAN_SEC);
  if (!eat) return;
  clamped = eat.active;

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
    neighborPatches: eat.neighborPatches,
    deleteIndices: eat.deleteIndices,
  });
  if (intent.kind === "select-segment") {
    if (ev.shiftKey) {
      suppressClickAfterPointer();
      a.onFocusWaveformShell?.();
      a.onSelectSegmentAt(intent.segmentIdx, { shiftKey: true });
      return;
    }
    if (ev.metaKey || ev.ctrlKey) {
      suppressClickAfterPointer();
      a.onFocusWaveformShell?.();
      a.onSelectSegmentAt(intent.segmentIdx, { toggle: true });
      return;
    }
  }
  applyOverlayPointerUpIntent(
    intent,
    overlayPointerActions(a, onSegmentPointerTap),
    suppressClickAfterPointer,
    {
      selectedIdxAtPointerDown: drag.selectedIdxAtPointerDown,
      viewportSyncedOnDown: drag.viewportSyncedOnDown,
      sessionId: drag.sessionId,
    },
  );
}

export function updateWaveformOverlayDragMove(input: {
  drag: OverlayDragState;
  clientX: number;
  timeSec: number;
  args: WaveformSegmentDragArgs;
  snapEnabled: boolean;
  updateCreatePreview: (preview: CreateRangePreview | null) => void;
  applySegmentDraft: (draft: SegmentOverlayDraft | null) => void;
}): void {
  const { drag, clientX, timeSec, args: a, snapEnabled, updateCreatePreview, applySegmentDraft } = input;
  if (drag.mode === "lasso") {
    if (pointerMovedPastWaveformDragThreshold(clientX, drag.anchorClientX)) {
      drag.moved = true;
    }
    if (!drag.moved) return;
    const lo = Math.min(drag.initialStartSec, timeSec);
    const hi = Math.max(drag.initialStartSec, timeSec);
    const clamped = snapCreateRange(a, lo, hi, snapEnabled);
    updateCreatePreview({ startSec: clamped.startSec, endSec: clamped.endSec });
    return;
  }

  if (pointerMovedPastWaveformDragThreshold(clientX, drag.anchorClientX)) {
    drag.moved = true;
  }
  if (!drag.moved) return;
  let clamped = boundsForOverlayDrag(drag, timeSec, a.durationSec);
  if (!clamped) return;
  const eat =
    finalizeEditDragBounds(
      a,
      drag,
      clamped,
      snapEnabled,
      // Match commit threshold so push-vs-delete preview does not flip on pointerup.
      WAVEFORM_SEGMENT_MIN_SPAN_SEC,
    ) ?? null;
  if (eat) {
    clamped = eat.active;
    drag.lastFinalizedBounds = clamped;
    applySegmentDraft({
      idx: drag.segmentIdx,
      ...clamped,
      ...(eat.neighborPatches.length > 0 ? { neighborPatches: eat.neighborPatches } : {}),
      ...(eat.deleteIndices.length > 0 ? { pendingDeleteIndices: eat.deleteIndices } : {}),
    });
    return;
  }
  drag.lastFinalizedBounds = clamped;
  applySegmentDraft({ idx: drag.segmentIdx, ...clamped });
}

export { SEGMENT_BOUNDS_LIVE_MIN_SPAN_SEC };
