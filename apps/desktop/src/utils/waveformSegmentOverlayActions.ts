import type { SegmentOverlapPolicy } from "./segmentTimeRange";
import type { OverlayPointerUpIntent } from "./waveformSegmentOverlayGestures";

export type SegmentOverlayTapGesture = {
  selectedIdxAtPointerDown: number;
  viewportSyncedOnDown?: boolean;
  sessionId?: string;
};

export type SegmentBoundsCommitOptions = {
  neighborPatches?: Array<{ idx: number; startSec: number; endSec: number }>;
  deleteIndices?: number[];
};

export type OverlayPointerActions = {
  onSegmentPointerTap: (
    segmentIdx: number,
    pointerTimeSec: number,
    tapGesture?: SegmentOverlayTapGesture,
  ) => void;
  onBoundsCommit: (
    idx: number,
    startSec: number,
    endSec: number,
    options?: SegmentBoundsCommitOptions,
  ) => void;
  onCreateRange?: (
    startSec: number,
    endSec: number,
    options?: { overlapPolicy?: SegmentOverlapPolicy },
  ) => void;
  onSelectTimeRange?: (startSec: number, endSec: number) => void;
  onFocusWaveformShell?: () => void;
  seekToTime: (timeSec: number) => void;
  suppressPlaybackFollowForSelectionSeek?: () => void;
};

export type SegmentOverlayTapResolution =
  | { kind: "select"; segmentIdx: number }
  | { kind: "seek-within"; timeSec: number };

/**
 * 语段 tap：未选中 → 选中并 seek 起点；已选中 → seek 到点击时刻（钳在语段内）。
 *
 * `viewportSyncedOnDown` means pointerdown just selected this segment (seek to
 * segment start already happened). pointerup must NOT seek-within — only commit
 * the selection. seek-within is reserved for tapping an already-selected segment.
 *
 * Primary-at-down must come from the pointerdown snapshot (or React SC1). Do not
 * fall back to SC2 chrome — playing-state down paints chrome before up, which
 * would misclassify a first select as seek-within (Transport Authority).
 */
export function resolveSegmentOverlayTap(args: {
  selectedIdx: number;
  selectedIdxAtPointerDown?: number;
  viewportSyncedOnDown?: boolean;
  segmentIdx: number;
  pointerTimeSec: number;
  segment: { start_sec: number; end_sec: number };
}): SegmentOverlayTapResolution {
  const lo = Math.min(args.segment.start_sec, args.segment.end_sec);
  const hi = Math.max(args.segment.start_sec, args.segment.end_sec);
  const clampedPointer = Math.max(lo, Math.min(hi, args.pointerTimeSec));

  if (args.viewportSyncedOnDown) {
    return { kind: "select", segmentIdx: args.segmentIdx };
  }
  const committedSelectedIdx = args.selectedIdxAtPointerDown ?? args.selectedIdx;
  if (committedSelectedIdx !== args.segmentIdx) {
    return { kind: "select", segmentIdx: args.segmentIdx };
  }
  return {
    kind: "seek-within",
    timeSec: clampedPointer,
  };
}

export function applySegmentOverlayTap(
  args: {
    selectedIdx: number;
    selectedIdxAtPointerDown?: number;
    viewportSyncedOnDown?: boolean;
    segmentIdx: number;
    pointerTimeSec: number;
    segment: { start_sec: number; end_sec: number };
  },
  actions: {
    onSelectSegmentAt: (idx: number, opts?: { shiftKey?: boolean }) => void;
    seekToTime: (timeSec: number) => void;
    suppressPlaybackFollowForSelectionSeek?: () => void;
  },
): void {
  const resolved = resolveSegmentOverlayTap(args);
  if (resolved.kind === "select") {
    actions.onSelectSegmentAt(resolved.segmentIdx);
    return;
  }
  actions.suppressPlaybackFollowForSelectionSeek?.();
  actions.seekToTime(resolved.timeSec);
}

/** 将 pointerup 意图分派到 overlay 回调（纯函数）。 */
export function applyOverlayPointerUpIntent(
  intent: OverlayPointerUpIntent,
  actions: OverlayPointerActions,
  suppressClick: () => void,
  tapGesture?: SegmentOverlayTapGesture,
): void {
  switch (intent.kind) {
    case "select-segment":
      suppressClick();
      actions.onSegmentPointerTap(intent.segmentIdx, intent.pointerTimeSec, tapGesture);
      break;
    case "commit-bounds": {
      suppressClick();
      if (intent.neighborPatches?.length || intent.deleteIndices?.length) {
        actions.onBoundsCommit(intent.segmentIdx, intent.startSec, intent.endSec, {
          neighborPatches: intent.neighborPatches,
          deleteIndices: intent.deleteIndices,
        });
      } else {
        actions.onBoundsCommit(intent.segmentIdx, intent.startSec, intent.endSec);
      }
      break;
    }
    case "create-range":
      suppressClick();
      actions.onCreateRange?.(intent.startSec, intent.endSec, {
        overlapPolicy: intent.overlapPolicy,
      });
      break;
    case "seek-blank":
      suppressClick();
      actions.onFocusWaveformShell?.();
      actions.suppressPlaybackFollowForSelectionSeek?.();
      actions.seekToTime(intent.timeSec);
      break;
    default:
      break;
  }
}
