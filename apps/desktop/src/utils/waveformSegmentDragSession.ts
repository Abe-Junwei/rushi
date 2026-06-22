import type { SegmentOverlayTapGesture } from "./waveformSegmentOverlayActions";

export const WAVEFORM_OVERLAY_SUPPRESS_CLICK_MS = 700;
export const WAVEFORM_OVERLAY_DRAG_MOVE_THRESHOLD_PX = 4;
const WAVEFORM_OVERLAY_TAP_GESTURE_MAX_AGE_MS = 700;

export type RecentSegmentTapGesture = SegmentOverlayTapGesture & {
  segmentIdx: number;
  createdAtMs: number;
};

export function createRecentSegmentTapGesture(input: {
  segmentIdx: number;
  selectedIdxAtPointerDown: number;
  viewportSyncedOnDown?: boolean;
  nowMs?: number;
}): RecentSegmentTapGesture {
  return {
    segmentIdx: input.segmentIdx,
    selectedIdxAtPointerDown: input.selectedIdxAtPointerDown,
    viewportSyncedOnDown: input.viewportSyncedOnDown,
    createdAtMs: input.nowMs ?? performance.now(),
  };
}

export function consumeRecentSegmentTapGesture(
  last: RecentSegmentTapGesture | null,
  segmentIdx: number,
  nowMs = performance.now(),
): SegmentOverlayTapGesture | undefined {
  if (!last || last.segmentIdx !== segmentIdx) return undefined;
  if (nowMs - last.createdAtMs > WAVEFORM_OVERLAY_TAP_GESTURE_MAX_AGE_MS) return undefined;
  return {
    selectedIdxAtPointerDown: last.selectedIdxAtPointerDown,
    viewportSyncedOnDown: last.viewportSyncedOnDown,
  };
}

export function pointerMovedPastWaveformDragThreshold(clientX: number, anchorClientX: number): boolean {
  return Math.abs(clientX - anchorClientX) > WAVEFORM_OVERLAY_DRAG_MOVE_THRESHOLD_PX;
}

export function releasePointerCaptureIfHeld(
  target: Pick<HTMLElement, "releasePointerCapture">,
  pointerId: number,
): void {
  try {
    target.releasePointerCapture(pointerId);
  } catch {
    /* noop */
  }
}
