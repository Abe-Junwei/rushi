import { afterEach, describe, expect, it, vi } from "vitest";
import {
  annotateSegmentListScrollMetrics,
  computeSegmentListVirtualWindow,
  ensureSegmentListVirtualWindowIncludesIndex,
  maybePinSegmentListVirtualWindow,
  resetScheduledSegmentListScrollForTests,
  scheduleScrollSegmentListIndexToView,
  scrollSegmentListIndexIntoView,
  scrollSegmentListIndexToView,
  scrollSegmentRowIntoViewContainer,
  resolveVirtualListScrollTopForWindow,
  resolveSegmentListRowIndexFromPoint,
  resolveSegmentListRangeDragHoverIndex,
  isEditableSegmentBodyTextarea,
  isSegmentBodyTextarea,
  segmentListRangeDragExceededSlop,
  segmentListRangeDragVerticalIntentExceededSlop,
  SEGMENT_LIST_FILTER_INDICES_ATTR,
  SEGMENT_LIST_SCROLL_ATTR,
  SEGMENT_LIST_VIRTUALIZE_MIN_COUNT,
  segmentListItemStridePx,
  segmentListVirtualRowTopPx,
  writeSegmentListFilterIndices,
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

  it("uses 90 segments as virtualize threshold", () => {
    expect(SEGMENT_LIST_VIRTUALIZE_MIN_COUNT).toBe(90);
  });

  it("segmentListVirtualRowTopPx maps display index to fixed stride slots", () => {
    const stride = segmentListItemStridePx(70);
    expect(segmentListVirtualRowTopPx(0, stride)).toBe(0);
    expect(segmentListVirtualRowTopPx(142, stride)).toBe(142 * stride);
  });

  it("scrolls selected row into view when off-screen (minimal align)", () => {
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

  it("resolveVirtualListScrollTopForWindow projects pre-layout scroll target when enabled", () => {
    const stride = 80;
    const rowMin = 70;
    const index = 20;
    const viewport = 400;
    const projected = resolveVirtualListScrollTopForWindow({
      rootScrollTop: 0,
      rootScrollHeight: 5000 * stride,
      rootClientHeight: viewport,
      scrollMetrics: { scrollTop: 0, viewportHeight: viewport },
      selectedDisplayIndex: index,
      rowMinHeightPx: rowMin,
      itemStridePx: stride,
      useSelectionProjection: true,
    });
    expect(projected).toBe(index * stride + rowMin - viewport);
    expect(
      resolveVirtualListScrollTopForWindow({
        rootScrollTop: index * stride,
        rootScrollHeight: 5000 * stride,
        rootClientHeight: viewport,
        scrollMetrics: { scrollTop: index * stride, viewportHeight: viewport },
        selectedDisplayIndex: index,
        rowMinHeightPx: rowMin,
        itemStridePx: stride,
        useSelectionProjection: true,
      }),
    ).toBe(index * stride);
  });

  it("resolveVirtualListScrollTopForWindow follows live scroll when projection disabled", () => {
    const stride = 80;
    const rowMin = 70;
    const index = 5;
    const viewport = 400;
    const liveScrollTop = 8000;
    expect(
      resolveVirtualListScrollTopForWindow({
        rootScrollTop: liveScrollTop,
        rootScrollHeight: 5000 * stride,
        rootClientHeight: viewport,
        scrollMetrics: { scrollTop: liveScrollTop, viewportHeight: viewport },
        selectedDisplayIndex: index,
        rowMinHeightPx: rowMin,
        itemStridePx: stride,
        useSelectionProjection: false,
      }),
    ).toBe(liveScrollTop);
  });

  it("centers selected row in viewport when align is center", () => {
    const stride = 80;
    const rowMin = 70;
    const index = 20;
    const viewport = 400;
    const rowCenter = index * stride + rowMin / 2;
    expect(
      scrollSegmentListIndexIntoView({
        scrollTop: 0,
        viewportHeight: viewport,
        index,
        rowMinHeightPx: rowMin,
        itemStridePx: stride,
        align: "center",
      }),
    ).toBe(Math.round(rowCenter - viewport / 2));
  });

  it("ensureSegmentListVirtualWindowIncludesIndex merges pin with scroll window (no replace)", () => {
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
    expect(merged.startIndex).toBe(base.startIndex);
    expect(merged.endIndex).toBeGreaterThan(120);
  });

  it("maybePinSegmentListVirtualWindow skips pin when merged span exceeds cap", () => {
    const stride = 80;
    const base = computeSegmentListVirtualWindow({
      scrollTop: stride * 200,
      viewportHeight: 400,
      itemStridePx: stride,
      totalCount: 500,
      overscan: 4,
    });
    const pinned = maybePinSegmentListVirtualWindow(base, 5, 500, stride);
    expect(pinned).toEqual(base);
  });

  it("maybePinSegmentListVirtualWindow merges nearby selected index", () => {
    const stride = 80;
    const base = computeSegmentListVirtualWindow({
      scrollTop: stride * 200,
      viewportHeight: 400,
      itemStridePx: stride,
      totalCount: 500,
      overscan: 4,
    });
    expect(base.endIndex).toBeLessThanOrEqual(210);
    const pinIndex = base.endIndex + 10;
    expect(pinIndex).toBeLessThan(500);
    const pinned = maybePinSegmentListVirtualWindow(base, pinIndex, 500, stride);
    expect(pinned.endIndex).toBeGreaterThan(base.endIndex);
    expect(pinned.endIndex).toBeGreaterThan(pinIndex);
  });

  it("scrollSegmentListIndexToView falls back to stride scroll when row is not mounted", () => {
    const root = document.createElement("div");
    Object.defineProperty(root, "clientHeight", { value: 400 });
    Object.defineProperty(root, "scrollHeight", { value: 5000 });
    Object.defineProperty(root, "scrollTop", { writable: true, value: 0 });
    root.setAttribute(SEGMENT_LIST_SCROLL_ATTR, "");
    annotateSegmentListScrollMetrics(root, { rowMinHeightPx: 70, itemStridePx: 80 });
    document.body.appendChild(root);

    const ok = scrollSegmentListIndexToView(25);
    expect(ok).toBe(true);
    expect(root.scrollTop).toBeGreaterThan(0);

    document.body.removeChild(root);
  });

  it("scrollSegmentRowIntoViewContainer scrolls when row is below viewport (minimal)", () => {
    const root = document.createElement("div");
    Object.defineProperty(root, "scrollTop", { writable: true, value: 0 });
    Object.defineProperty(root, "scrollHeight", { value: 2000 });
    Object.defineProperty(root, "clientHeight", { value: 400 });
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

  it("scrollSegmentRowIntoViewContainer centers row in viewport", () => {
    const root = document.createElement("div");
    Object.defineProperty(root, "scrollTop", { writable: true, value: 100 });
    Object.defineProperty(root, "scrollHeight", { value: 2000 });
    Object.defineProperty(root, "clientHeight", { value: 400 });
    const row = document.createElement("div");
    row.setAttribute("data-seg-row", "5");
    root.appendChild(row);
    root.getBoundingClientRect = () =>
      ({ top: 100, bottom: 500, left: 0, right: 400, width: 400, height: 400, x: 0, y: 100, toJSON: () => ({}) });
    row.getBoundingClientRect = () =>
      ({ top: 520, bottom: 600, left: 0, right: 400, width: 400, height: 80, x: 0, y: 520, toJSON: () => ({}) });

    const next = scrollSegmentRowIntoViewContainer(5, root, { align: "center" });
    expect(next).toBe(360);
  });

  it("segmentListRangeDragExceededSlop ignores sub-threshold jitter", () => {
    expect(segmentListRangeDragExceededSlop(100, 200, 103, 202)).toBe(false);
    expect(segmentListRangeDragExceededSlop(100, 200, 106, 200)).toBe(true);
  });

  it("segmentListRangeDragVerticalIntentExceededSlop requires vertical-dominant movement", () => {
    expect(segmentListRangeDragVerticalIntentExceededSlop(100, 200, 130, 206)).toBe(false);
    expect(segmentListRangeDragVerticalIntentExceededSlop(100, 200, 103, 212)).toBe(true);
  });

  it("isEditableSegmentBodyTextarea ignores readOnly segment textareas", () => {
    const readOnly = document.createElement("textarea");
    readOnly.setAttribute("aria-label", "语段正文");
    readOnly.readOnly = true;
    expect(isSegmentBodyTextarea(readOnly)).toBe(true);
    expect(isEditableSegmentBodyTextarea(readOnly)).toBe(false);

    const editable = document.createElement("textarea");
    editable.setAttribute("aria-label", "语段正文");
    expect(isSegmentBodyTextarea(editable)).toBe(true);
    expect(isEditableSegmentBodyTextarea(editable)).toBe(true);
  });

  it("resolveSegmentListRowIndexFromPoint reads data-seg-row under cursor", () => {
    const root = document.createElement("div");
    root.setAttribute(SEGMENT_LIST_SCROLL_ATTR, "");
    annotateSegmentListScrollMetrics(root, { rowMinHeightPx: 70, itemStridePx: 80 });
    document.body.appendChild(root);

    const row2 = document.createElement("div");
    row2.setAttribute("data-seg-row", "2");
    root.appendChild(row2);

    document.elementFromPoint = () => row2;
    expect(resolveSegmentListRowIndexFromPoint(root, 20, 230, 10)).toBe(2);
    document.body.removeChild(root);
  });

  it("resolveSegmentListRowIndexFromPoint falls back to stride when row is unmounted", () => {
    const root = document.createElement("div");
    root.setAttribute(SEGMENT_LIST_SCROLL_ATTR, "");
    annotateSegmentListScrollMetrics(root, { rowMinHeightPx: 70, itemStridePx: 80 });
    Object.defineProperty(root, "scrollTop", { writable: true, value: 0 });
    root.getBoundingClientRect = () =>
      ({ top: 0, bottom: 400, left: 0, right: 400, width: 400, height: 400, x: 0, y: 0, toJSON: () => ({}) });
    document.body.appendChild(root);

    document.elementFromPoint = () => null;
    expect(resolveSegmentListRowIndexFromPoint(root, 20, 170, 10)).toBe(2);
    document.body.removeChild(root);
  });

  it("resolveSegmentListRowIndexFromPoint maps stride fallback through filter indices", () => {
    const root = document.createElement("div");
    root.setAttribute(SEGMENT_LIST_SCROLL_ATTR, "");
    annotateSegmentListScrollMetrics(root, { rowMinHeightPx: 70, itemStridePx: 80 });
    writeSegmentListFilterIndices(root, [10, 20, 30], true);
    Object.defineProperty(root, "scrollTop", { writable: true, value: 0 });
    root.getBoundingClientRect = () =>
      ({ top: 0, bottom: 400, left: 0, right: 400, width: 400, height: 400, x: 0, y: 0, toJSON: () => ({}) });
    document.body.appendChild(root);

    document.elementFromPoint = () => null;
    expect(resolveSegmentListRowIndexFromPoint(root, 20, 150, 100)).toBe(20);

    document.body.removeChild(root);
  });

  it("resolveSegmentListRangeDragHoverIndex clamps to first/last row outside viewport (S8)", () => {
    const root = document.createElement("div");
    root.setAttribute(SEGMENT_LIST_SCROLL_ATTR, "");
    annotateSegmentListScrollMetrics(root, { rowMinHeightPx: 70, itemStridePx: 80 });
    writeSegmentListFilterIndices(root, [5, 15, 25], true);
    root.getBoundingClientRect = () =>
      ({ top: 100, bottom: 500, left: 0, right: 400, width: 400, height: 400, x: 0, y: 100, toJSON: () => ({}) });
    document.body.appendChild(root);

    document.elementFromPoint = () => null;
    expect(resolveSegmentListRangeDragHoverIndex(root, 20, 80, 100)).toBe(5);
    expect(resolveSegmentListRangeDragHoverIndex(root, 20, 520, 100)).toBe(25);

    document.body.removeChild(root);
  });

  it("scrollSegmentListIndexToView uses display index when filter attr is set", () => {
    const root = document.createElement("div");
    Object.defineProperty(root, "clientHeight", { value: 100 });
    Object.defineProperty(root, "scrollHeight", { value: 240 });
    Object.defineProperty(root, "scrollTop", { writable: true, value: 0 });
    root.setAttribute(SEGMENT_LIST_SCROLL_ATTR, "");
    writeSegmentListFilterIndices(root, [0, 50, 99], true);
    annotateSegmentListScrollMetrics(root, { rowMinHeightPx: 70, itemStridePx: 80 });
    document.body.appendChild(root);

    expect(scrollSegmentListIndexToView(99)).toBe(true);
    expect(root.scrollTop).toBeGreaterThan(0);
    expect(root.getAttribute(SEGMENT_LIST_FILTER_INDICES_ATTR)).toBe("0,50,99");

    document.body.removeChild(root);
  });

  it("scheduleScrollSegmentListIndexToView coalesces rapid requests to the last index", () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    Object.defineProperty(root, "clientHeight", { value: 100 });
    Object.defineProperty(root, "scrollHeight", { value: 8000 });
    Object.defineProperty(root, "scrollTop", { writable: true, value: 0 });
    root.setAttribute(SEGMENT_LIST_SCROLL_ATTR, "");
    annotateSegmentListScrollMetrics(root, { rowMinHeightPx: 70, itemStridePx: 80 });
    document.body.appendChild(root);

    scheduleScrollSegmentListIndexToView(5);
    scheduleScrollSegmentListIndexToView(25);
    vi.advanceTimersByTime(32);

    expect(root.scrollTop).toBeGreaterThan(0);

    document.body.removeChild(root);
    resetScheduledSegmentListScrollForTests();
    vi.useRealTimers();
  });
});

afterEach(() => {
  resetScheduledSegmentListScrollForTests();
});
