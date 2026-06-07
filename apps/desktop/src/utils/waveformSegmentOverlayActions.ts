import type { SegmentOverlapPolicy } from "./segmentTimeRange";
import type { OverlayPointerUpIntent } from "./waveformSegmentOverlayGestures";

export type OverlayPointerActions = {
  onSegmentPointerTap: (segmentIdx: number, pointerTimeSec: number) => void;
  onBoundsCommit: (idx: number, startSec: number, endSec: number) => void;
  onCreateRange?: (
    startSec: number,
    endSec: number,
    options?: { overlapPolicy?: SegmentOverlapPolicy },
  ) => void;
  onSelectTimeRange?: (startSec: number, endSec: number) => void;
  onFocusWaveformShell?: () => void;
  seekToTime: (timeSec: number) => void;
};

export type SegmentOverlayTapResolution =
  | { kind: "select"; segmentIdx: number }
  | { kind: "seek-within"; timeSec: number };

/** 语段 tap：未选中 → 选中并 seek 起点；已选中 → seek 到点击时刻（钳在语段内）。 */
export function resolveSegmentOverlayTap(args: {
  selectedIdx: number;
  segmentIdx: number;
  pointerTimeSec: number;
  segment: { start_sec: number; end_sec: number };
}): SegmentOverlayTapResolution {
  if (args.selectedIdx !== args.segmentIdx) {
    return { kind: "select", segmentIdx: args.segmentIdx };
  }
  const lo = Math.min(args.segment.start_sec, args.segment.end_sec);
  const hi = Math.max(args.segment.start_sec, args.segment.end_sec);
  return {
    kind: "seek-within",
    timeSec: Math.max(lo, Math.min(hi, args.pointerTimeSec)),
  };
}

export function applySegmentOverlayTap(
  args: {
    selectedIdx: number;
    segmentIdx: number;
    pointerTimeSec: number;
    segment: { start_sec: number; end_sec: number };
  },
  actions: {
    onSelectSegmentAt: (idx: number, opts?: { shiftKey?: boolean }) => void;
    seekToTime: (timeSec: number) => void;
    revealSelectedSegmentInViewport?: () => void;
  },
): void {
  const resolved = resolveSegmentOverlayTap(args);
  if (resolved.kind === "select") {
    actions.onSelectSegmentAt(resolved.segmentIdx);
    return;
  }
  actions.revealSelectedSegmentInViewport?.();
  actions.seekToTime(resolved.timeSec);
}

/** 将 pointerup 意图分派到 overlay 回调（纯函数）。 */
export function applyOverlayPointerUpIntent(
  intent: OverlayPointerUpIntent,
  actions: OverlayPointerActions,
  suppressClick: () => void,
): void {
  switch (intent.kind) {
    case "select-segment":
      suppressClick();
      actions.onFocusWaveformShell?.();
      actions.onSegmentPointerTap(intent.segmentIdx, intent.pointerTimeSec);
      break;
    case "commit-bounds":
      suppressClick();
      actions.onBoundsCommit(intent.segmentIdx, intent.startSec, intent.endSec);
      break;
    case "create-range":
      suppressClick();
      actions.onCreateRange?.(intent.startSec, intent.endSec, {
        overlapPolicy: intent.overlapPolicy,
      });
      break;
    case "seek-blank":
      suppressClick();
      actions.onFocusWaveformShell?.();
      actions.seekToTime(intent.timeSec);
      break;
    default:
      break;
  }
}
