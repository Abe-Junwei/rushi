import { describe, expect, it } from "vitest";
import {
  annotateSegmentListScrollMetrics,
  computeSegmentListVirtualWindow,
  ensureSegmentListVirtualWindowIncludesIndex,
  scrollSegmentListIndexIntoView,
  scrollSegmentListIndexToView,
  scrollSegmentRowIntoViewContainer,
  SEGMENT_LIST_SCROLL_ATTR,
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

  it("ensureSegmentListVirtualWindowIncludesIndex expands when pin is outside window", () => {
    const stride = 80;
    const base = computeSegmentListVirtualWindow({
      scrollTop: 0,
      viewportHeight: 400,
      itemStridePx: stride,
      totalCount: 200,
      overscan: 4,
    });
    expect(base.endIndex).toBeLessThan(50);
    const merged = ensureSegmentListVirtualWindowIncludesIndex(base, 120, 200, stride);
    expect(merged.startIndex).toBeLessThanOrEqual(120);
    expect(merged.endIndex).toBeGreaterThan(120);
  });

  it("scrollSegmentListIndexToView falls back to stride scroll when row is not mounted", () => {
    const root = document.createElement("div");
    Object.defineProperty(root, "clientHeight", { value: 400 });
    Object.defineProperty(root, "scrollTop", { writable: true, value: 0 });
    root.setAttribute(SEGMENT_LIST_SCROLL_ATTR, "");
    annotateSegmentListScrollMetrics(root, { rowMinHeightPx: 70, itemStridePx: 80 });
    document.body.appendChild(root);

    const ok = scrollSegmentListIndexToView(25);
    expect(ok).toBe(true);
    expect(root.scrollTop).toBeGreaterThan(0);

    document.body.removeChild(root);
  });

  it("scrollSegmentRowIntoViewContainer scrolls when row is below viewport", () => {
    const root = document.createElement("div");
    Object.defineProperty(root, "scrollTop", { writable: true, value: 0 });
    const row = document.createElement("div");
    row.setAttribute("data-seg-row", "5");
    root.appendChild(row);
    root.getBoundingClientRect = () =>
      ({ top: 100, bottom: 500, left: 0, right: 400, width: 400, height: 400, x: 0, y: 100, toJSON: () => ({}) });
    row.getBoundingClientRect = () =>
      ({ top: 520, bottom: 600, left: 0, right: 400, width: 400, height: 80, x: 0, y: 520, toJSON: () => ({}) });

    const next = scrollSegmentRowIntoViewContainer(5, root);
    expect(next).not.toBeNull();
    expect(next!).toBeGreaterThan(0);
  });
});
