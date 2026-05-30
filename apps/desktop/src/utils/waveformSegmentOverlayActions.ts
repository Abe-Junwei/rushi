import type { SegmentOverlapPolicy } from "./segmentTimeRange";
import type { OverlayPointerUpIntent } from "./waveformSegmentOverlayGestures";

export type OverlayPointerActions = {
  onSelectSegmentAt: (idx: number) => void;
  onBoundsCommit: (idx: number, startSec: number, endSec: number) => void;
  onCreateRange?: (
    startSec: number,
    endSec: number,
    options?: { overlapPolicy?: SegmentOverlapPolicy },
  ) => void;
  onFocusWaveformShell?: () => void;
  seekToTime: (timeSec: number) => void;
};

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
      actions.onSelectSegmentAt(intent.segmentIdx);
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
