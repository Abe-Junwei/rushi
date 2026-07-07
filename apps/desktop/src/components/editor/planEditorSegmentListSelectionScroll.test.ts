import { describe, expect, it } from "vitest";
import {
  segmentListItemStridePx,
  segmentListRowMinHeightPx,
} from "../../utils/segmentListVirtualWindow";
import { planEditorSegmentListSelectionScroll } from "./planEditorSegmentListSelectionScroll";

function createScrollRoot(scrollTop: number, clientHeight: number, scrollHeight: number): HTMLDivElement {
  const el = document.createElement("div");
  let top = scrollTop;
  Object.defineProperty(el, "clientHeight", { configurable: true, value: clientHeight });
  Object.defineProperty(el, "scrollHeight", { configurable: true, value: scrollHeight });
  Object.defineProperty(el, "scrollTop", {
    configurable: true,
    get: () => top,
    set: (v: number) => {
      top = v;
    },
  });
  return el;
}

function expectedCenterScrollTop(
  index: number,
  rowMin: number,
  stride: number,
  viewport: number,
  scrollHeight: number,
): number {
  const maxScrollTop = Math.max(0, scrollHeight - viewport);
  const rowTop = index * stride;
  const rowCenter = rowTop + rowMin / 2;
  return Math.max(0, Math.min(maxScrollTop, rowCenter - viewport / 2));
}

describe("planEditorSegmentListSelectionScroll", () => {
  it("listKeyboard scrolls before row sticks to bottom edge (keyboard align)", () => {
    const rowMin = segmentListRowMinHeightPx(70);
    const stride = segmentListItemStridePx(rowMin);
    const viewport = 480;
    const displayCount = 200;
    const scrollHeight = displayCount * stride;
    const index = 5;
    const root = createScrollRoot(index * stride + rowMin - viewport, viewport, scrollHeight);
    const row = document.createElement("div");
    row.setAttribute("data-seg-row", String(index));
    Object.defineProperty(root, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ top: 0, bottom: viewport, left: 0, right: 400 }),
    });
    Object.defineProperty(row, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ top: viewport - rowMin, bottom: viewport, left: 0, right: 400 }),
    });
    root.appendChild(row);

    const waveformAtFive = planEditorSegmentListSelectionScroll({
      root,
      selectedDisplayIndex: index,
      selectedIdx: index,
      rowMinHeightPx: rowMin,
      itemStridePx: stride,
      useVirtualList: true,
      source: "waveform",
    });
    expect(waveformAtFive.kind).toBe("skip");

    const keyboardAtFive = planEditorSegmentListSelectionScroll({
      root,
      selectedDisplayIndex: index,
      selectedIdx: index,
      rowMinHeightPx: rowMin,
      itemStridePx: stride,
      useVirtualList: true,
      source: "listKeyboard",
    });
    expect(keyboardAtFive.kind).toBe("write-scroll");
    if (keyboardAtFive.kind === "write-scroll") {
      expect(keyboardAtFive.nextScrollTop).toBeGreaterThan(root.scrollTop);
    }
  });

  it("waveform scrolls when selected row is mounted off-screen by virtual pin", () => {
    const rowMin = segmentListRowMinHeightPx(70);
    const stride = segmentListItemStridePx(rowMin);
    const viewport = 480;
    const displayCount = 200;
    const scrollHeight = displayCount * stride;
    const index = 40;
    const root = createScrollRoot(index * stride, viewport, scrollHeight);
    const row = document.createElement("div");
    row.setAttribute("data-seg-row", String(index));
    Object.defineProperty(row, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        top: index * stride,
        bottom: index * stride + rowMin,
        left: 0,
        right: 400,
      }),
    });
    root.appendChild(row);
    Object.defineProperty(root, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ top: 0, bottom: viewport, left: 0, right: 400 }),
    });

    const plan = planEditorSegmentListSelectionScroll({
      root,
      selectedDisplayIndex: index,
      selectedIdx: index,
      rowMinHeightPx: rowMin,
      itemStridePx: stride,
      useVirtualList: true,
      source: "waveform",
    });

    expect(plan.kind).toBe("write-scroll");
    if (plan.kind === "write-scroll") {
      expect(plan.nextScrollTop).toBeGreaterThanOrEqual(0);
    }
  });

  it("waveform forces mount scroll when selected row is not in DOM", () => {
    const rowMin = segmentListRowMinHeightPx(70);
    const stride = segmentListItemStridePx(rowMin);
    const viewport = 480;
    const displayCount = 200;
    const scrollHeight = displayCount * stride;
    const index = 40;
    const root = createScrollRoot(index * stride, viewport, scrollHeight);

    const plan = planEditorSegmentListSelectionScroll({
      root,
      selectedDisplayIndex: index,
      selectedIdx: index,
      rowMinHeightPx: rowMin,
      itemStridePx: stride,
      useVirtualList: true,
      source: "waveform",
    });

    expect(plan.kind).toBe("write-scroll");
    if (plan.kind === "write-scroll") {
      expect(plan.nextScrollTop).toBeCloseTo(
        expectedCenterScrollTop(index, rowMin, stride, viewport, scrollHeight),
        0,
      );
    }
  });

  it("waveform scrolls when selected row is not in DOM but scrollTop is stale", () => {
    const rowMin = segmentListRowMinHeightPx(70);
    const stride = segmentListItemStridePx(rowMin);
    const viewport = 480;
    const displayCount = 200;
    const scrollHeight = displayCount * stride;
    const index = 40;
    const root = createScrollRoot(0, viewport, scrollHeight);

    const plan = planEditorSegmentListSelectionScroll({
      root,
      selectedDisplayIndex: index,
      selectedIdx: index,
      rowMinHeightPx: rowMin,
      itemStridePx: stride,
      useVirtualList: true,
      source: "waveform",
    });

    expect(plan.kind).toBe("write-scroll");
    if (plan.kind === "write-scroll") {
      expect(plan.nextScrollTop).toBeCloseTo(
        expectedCenterScrollTop(index, rowMin, stride, viewport, scrollHeight),
        0,
      );
    }
  });

  it("listKeyboard forces mount scroll when selected row is not in DOM", () => {
    const rowMin = segmentListRowMinHeightPx(70);
    const stride = segmentListItemStridePx(rowMin);
    const viewport = 480;
    const displayCount = 200;
    const scrollHeight = displayCount * stride;
    const index = 40;
    const root = createScrollRoot(index * stride, viewport, scrollHeight);

    const plan = planEditorSegmentListSelectionScroll({
      root,
      selectedDisplayIndex: index,
      selectedIdx: index,
      rowMinHeightPx: rowMin,
      itemStridePx: stride,
      useVirtualList: true,
      source: "listKeyboard",
    });

    expect(plan.kind).toBe("write-scroll");
    if (plan.kind === "write-scroll") {
      expect(plan.nextScrollTop).toBe(index * stride);
      expect(plan.syncEpoch).toBe(true);
      expect(plan.skipDomCorrection).toBe(true);
    }
  });
});
