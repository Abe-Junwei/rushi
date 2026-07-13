export const WAVEFORM_OVERLAY_SUPPRESS_CLICK_MS = 700;
export const WAVEFORM_OVERLAY_DRAG_MOVE_THRESHOLD_PX = 4;

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
