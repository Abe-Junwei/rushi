/** Edge band for range-drag auto-scroll (≈20% of typical list viewport). */
export const SEGMENT_LIST_DRAG_AUTO_SCROLL_EDGE_PX = 48;
export const SEGMENT_LIST_DRAG_AUTO_SCROLL_MIN_SPEED_PX = 4;
export const SEGMENT_LIST_DRAG_AUTO_SCROLL_MAX_SPEED_PX = 24;

/** @deprecated Use min/max speed constants; kept for tests migrating off fixed step. */
export const SEGMENT_LIST_DRAG_AUTO_SCROLL_STEP_PX = SEGMENT_LIST_DRAG_AUTO_SCROLL_MAX_SPEED_PX;

function edgeScrollSpeedPx(
  distanceIntoBandPx: number,
  thresholdPx: number,
  minSpeedPx: number,
  maxSpeedPx: number,
): number {
  const distance = Math.max(0, Math.min(thresholdPx, distanceIntoBandPx));
  return minSpeedPx + (maxSpeedPx - minSpeedPx) * (1 - distance / thresholdPx);
}

/** Returns scrollTop delta per frame; 0 in middle band. Pointer may be outside the viewport rect. */
export function computeSegmentListDragAutoScrollDelta(input: {
  clientY: number;
  rootTop: number;
  rootBottom: number;
  edgePx?: number;
  minSpeedPx?: number;
  maxSpeedPx?: number;
}): number {
  const edge = input.edgePx ?? SEGMENT_LIST_DRAG_AUTO_SCROLL_EDGE_PX;
  const minSpeed = input.minSpeedPx ?? SEGMENT_LIST_DRAG_AUTO_SCROLL_MIN_SPEED_PX;
  const maxSpeed = input.maxSpeedPx ?? SEGMENT_LIST_DRAG_AUTO_SCROLL_MAX_SPEED_PX;

  if (input.clientY < input.rootTop) {
    return -maxSpeed;
  }
  if (input.clientY < input.rootTop + edge) {
    const distance = input.rootTop + edge - input.clientY;
    return -edgeScrollSpeedPx(distance, edge, minSpeed, maxSpeed);
  }
  if (input.clientY > input.rootBottom) {
    return maxSpeed;
  }
  if (input.clientY > input.rootBottom - edge) {
    const distance = input.clientY - (input.rootBottom - edge);
    return edgeScrollSpeedPx(distance, edge, minSpeed, maxSpeed);
  }
  return 0;
}
