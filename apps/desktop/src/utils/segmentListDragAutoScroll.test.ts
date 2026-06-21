import { describe, expect, it } from "vitest";
import {
  computeSegmentListDragAutoScrollDelta,
  SEGMENT_LIST_DRAG_AUTO_SCROLL_EDGE_PX,
  SEGMENT_LIST_DRAG_AUTO_SCROLL_MAX_SPEED_PX,
  SEGMENT_LIST_DRAG_AUTO_SCROLL_MIN_SPEED_PX,
} from "./segmentListDragAutoScroll";

describe("computeSegmentListDragAutoScrollDelta", () => {
  const root = { rootTop: 100, rootBottom: 500 };
  const edge = SEGMENT_LIST_DRAG_AUTO_SCROLL_EDGE_PX;
  const min = SEGMENT_LIST_DRAG_AUTO_SCROLL_MIN_SPEED_PX;
  const max = SEGMENT_LIST_DRAG_AUTO_SCROLL_MAX_SPEED_PX;

  it("returns 0 in the middle band", () => {
    expect(computeSegmentListDragAutoScrollDelta({ ...root, clientY: 300 })).toBe(0);
  });

  it("uses near-min speed just inside the top edge band", () => {
    const delta = computeSegmentListDragAutoScrollDelta({
      ...root,
      clientY: root.rootTop + edge - 0.01,
    });
    expect(delta).toBeGreaterThan(-min - 0.1);
    expect(delta).toBeLessThan(-min + 0.5);
  });

  it("uses max speed at the outer top edge", () => {
    expect(
      computeSegmentListDragAutoScrollDelta({
        ...root,
        clientY: root.rootTop,
      }),
    ).toBeCloseTo(-max, 5);
  });

  it("uses near-min speed just inside the bottom edge band", () => {
    const delta = computeSegmentListDragAutoScrollDelta({
      ...root,
      clientY: root.rootBottom - edge + 0.01,
    });
    expect(delta).toBeGreaterThan(min - 0.1);
    expect(delta).toBeLessThan(min + 0.5);
  });

  it("uses max speed at the outer bottom edge", () => {
    expect(
      computeSegmentListDragAutoScrollDelta({
        ...root,
        clientY: root.rootBottom,
      }),
    ).toBeCloseTo(max, 5);
  });

  it("linearly interpolates speed within the top edge band", () => {
    const midY = root.rootTop + edge / 2;
    const delta = computeSegmentListDragAutoScrollDelta({ ...root, clientY: midY });
    expect(delta).toBeLessThan(-min);
    expect(delta).toBeGreaterThan(-max);
    expect(delta).toBeCloseTo(-(min + (max - min) * 0.5), 5);
  });

  it("keeps scrolling up when pointer is above the viewport", () => {
    expect(computeSegmentListDragAutoScrollDelta({ ...root, clientY: 20 })).toBe(-max);
  });

  it("keeps scrolling down when pointer is below the viewport", () => {
    expect(computeSegmentListDragAutoScrollDelta({ ...root, clientY: 620 })).toBe(max);
  });
});
