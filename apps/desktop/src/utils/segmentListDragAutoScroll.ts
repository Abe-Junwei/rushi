/** Edge band for range-drag auto-scroll (≈20% of typical list viewport). */
export const SEGMENT_LIST_DRAG_AUTO_SCROLL_EDGE_PX = 48;
export const SEGMENT_LIST_DRAG_AUTO_SCROLL_MIN_SPEED_PX = 4;
export const SEGMENT_LIST_DRAG_AUTO_SCROLL_MAX_SPEED_PX = 24;

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

  const speedTowardBottom = (penetrationPx: number): number => {
    const t = Math.max(0, Math.min(edge, penetrationPx)) / edge;
    return minSpeed + (maxSpeed - minSpeed) * t;
  };
  const speedTowardTop = (penetrationPx: number): number =>
    -speedTowardBottom(penetrationPx);

  if (input.clientY > input.rootBottom) {
    return maxSpeed;
  }
  if (input.clientY > input.rootBottom - edge) {
    return speedTowardBottom(input.clientY - (input.rootBottom - edge));
  }
  if (input.clientY < input.rootTop) {
    return speedTowardTop(edge);
  }
  if (input.clientY < input.rootTop + edge) {
    return speedTowardTop((input.rootTop + edge) - input.clientY);
  }
  return 0;
}
