import { describe, expect, it } from "vitest";
import {
  computeSegmentListVirtualWindow,
  scrollSegmentListIndexIntoView,
  segmentListItemStridePx,
} from "./segmentListVirtualWindow";

describe("segmentListVirtualWindow", () => {
  it("computes a bounded window for large lists", () => {
    const stride = segmentListItemStridePx(70);
    const win = computeSegmentListVirtualWindow({
      scrollTop: stride * 200,
      viewportHeight: 600,
      itemStridePx: stride,
      totalCount: 5000,
      overscan: 4,
    });
    expect(win.startIndex).toBeLessThan(200);
    expect(win.endIndex).toBeGreaterThan(200);
    expect(win.endIndex - win.startIndex).toBeLessThan(80);
    expect(win.paddingTopPx).toBe(win.startIndex * stride);
    expect(win.totalHeightPx).toBe(5000 * stride);
  });

  it("returns full range when viewport is unknown", () => {
    const win = computeSegmentListVirtualWindow({
      scrollTop: 0,
      viewportHeight: 0,
      itemStridePx: 80,
      totalCount: 12,
    });
    expect(win.startIndex).toBe(0);
    expect(win.endIndex).toBe(12);
  });

  it("scrolls selected row into view when off-screen", () => {
    const stride = 80;
    expect(
      scrollSegmentListIndexIntoView({
        scrollTop: 0,
        viewportHeight: 400,
        index: 20,
        rowMinHeightPx: 70,
        itemStridePx: stride,
      }),
    ).toBe(20 * stride + 70 - 400);
    expect(
      scrollSegmentListIndexIntoView({
        scrollTop: 20 * stride,
        viewportHeight: 400,
        index: 20,
        rowMinHeightPx: 70,
        itemStridePx: stride,
      }),
    ).toBeNull();
  });
});
