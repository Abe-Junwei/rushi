import type { SegmentDto } from "../tauri/projectApi";
import {
  clampSegmentTimeBounds,
  selectPackableSegmentIndices,
  WAVEFORM_SEGMENT_MIN_SPAN_SEC,
} from "../utils/waveformSegmentBounds";
import {
  finalizeSegmentOverlayBounds,
  SEGMENT_BOUNDS_LIVE_MIN_SPAN_SEC,
} from "../utils/segmentGapPolicy";
import { resolveCreateOverlapPolicy, type SegmentOverlayPointerModifiers } from "../utils/segmentOverlayModifiers";
import {
  collectSegmentSnapTargets,
  resolveSnapThresholdSec,
  snapSegmentRange,
} from "../utils/segmentTimeSnap";
import { applyOverlayPointerUpIntent, type OverlayPointerActions } from "../utils/waveformSegmentOverlayActions";
import {
  boundsForOverlayDrag,
  type OverlayDragState,
} from "../utils/waveformSegmentOverlayGeometry";
import { resolveOverlayPointerUpIntent } from "../utils/waveformSegmentOverlayGestures";
import { computeSegmentLassoOutcome } from "../utils/segmentSelection";
import type { WaveformSegmentDragArgs } from "./useWaveformSegmentDrag";

export function overlayPointerActions(
  a: WaveformSegmentDragArgs,
  onSegmentPointerTap: (segmentIdx: number, pointerTimeSec: number) => void,
): OverlayPointerActions {
  return {
    onSegmentPointerTap,
    onBoundsCommit: a.onBoundsCommit,
    onCreateRange: a.onCreateRange,
    onSelectTimeRange: a.onSelectTimeRange,
    onFocusWaveformShell: a.onFocusWaveformShell,
    seekToTime: a.seekToTime,
  };
}

export function snapTargetsForOverlay(
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
): { startSec: number; endSec: number } | null {
  if (drag.mode === "lasso") return null;
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
    if (a.isMultiSegmentSelection?.()) {
      a.onClearMultiSelection?.();
    } else {
      a.seekToTime(drag.anchorTimeSec);
    }
    return true;
  }

  const baseIndices = drag.baseIndices ?? new Set<number>();
  const outcome = computeSegmentLassoOutcome(a.segments, lo, hi, a.durationSec, baseIndices);
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
    const overlapPolicy = resolveCreateOverlapPolicy(modifiers);
    suppressClickAfterPointer();
    a.onCreateRange?.(clamped.startSec, clamped.endSec, { overlapPolicy });
    return true;
  }

  suppressClickAfterPointer();
  a.onFocusWaveformShell?.();
  if (a.isMultiSegmentSelection?.()) {
    a.onClearMultiSelection?.();
  } else {
    a.seekToTime(timeSec);
  }
  return true;
}

export function finishWaveformEditDrag(input: {
  drag: OverlayDragState;
  timeSec: number;
  args: WaveformSegmentDragArgs;
  snapEnabled: boolean;
  ev: Pick<React.PointerEvent, "shiftKey" | "metaKey" | "ctrlKey">;
  onSegmentPointerTap: (segmentIdx: number, pointerTimeSec: number) => void;
  suppressClickAfterPointer: () => void;
}): void {
  const { drag, timeSec, args: a, snapEnabled, ev, onSegmentPointerTap, suppressClickAfterPointer } = input;

  let clamped = boundsForOverlayDrag(drag, timeSec, a.durationSec);
  if (!clamped) return;

  const finalized = finalizeEditDragBounds(a, drag, clamped, snapEnabled, WAVEFORM_SEGMENT_MIN_SPAN_SEC);
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
  );
}

export { SEGMENT_BOUNDS_LIVE_MIN_SPAN_SEC };
