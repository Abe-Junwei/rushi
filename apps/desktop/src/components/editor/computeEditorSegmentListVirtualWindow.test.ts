import { describe, expect, it, afterEach } from "vitest";
import {
  pinListKeyboardVirtualDisplayIndex,
  resetListKeyboardBurstCoordinatorForTests,
} from "../../services/selection/listKeyboardBurstCoordinator";
import {
  segmentListItemStridePx,
  segmentListRowMinHeightPx,
  SEGMENT_LIST_VIRTUALIZE_MIN_COUNT,
} from "../../utils/segmentListVirtualWindow";
import { computeEditorSegmentListVirtualWindow } from "./computeEditorSegmentListVirtualWindow";

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

describe("computeEditorSegmentListVirtualWindow", () => {
  afterEach(() => {
    resetListKeyboardBurstCoordinatorForTests();
  });

  it("pins far waveform selection into virtual window before list scroll settles", () => {
    const rowMin = segmentListRowMinHeightPx(70);
    const stride = segmentListItemStridePx(rowMin);
    const displayCount = SEGMENT_LIST_VIRTUALIZE_MIN_COUNT + 20;
    const root = createScrollRoot(0, 400, displayCount * stride);

    const win = computeEditorSegmentListVirtualWindow({
      segmentListRoot: root,
      scrollMetricsRef: { current: { scrollTop: 0, viewportHeight: 400 } },
      selectedDisplayIndex: 55,
      displayCount,
      itemStridePx: stride,
      useVirtualList: true,
      source: "waveform",
    });

    expect(win.startIndex).toBeLessThanOrEqual(55);
    expect(win.endIndex).toBeGreaterThan(55);
  });

  it("ignores stale listKeyboard pin when source is waveform (SCB-2)", () => {
    const rowMin = segmentListRowMinHeightPx(70);
    const stride = segmentListItemStridePx(rowMin);
    const displayCount = SEGMENT_LIST_VIRTUALIZE_MIN_COUNT + 20;
    const root = createScrollRoot(0, 400, displayCount * stride);

    pinListKeyboardVirtualDisplayIndex(50);

    const win = computeEditorSegmentListVirtualWindow({
      segmentListRoot: root,
      scrollMetricsRef: { current: { scrollTop: 0, viewportHeight: 400 } },
      selectedDisplayIndex: 55,
      displayCount,
      itemStridePx: stride,
      useVirtualList: true,
      source: "waveform",
    });

    expect(win.startIndex).toBeLessThanOrEqual(55);
    expect(win.endIndex).toBeGreaterThan(55);
  });

  it("pins selected row for list source even without listKeyboard coordinator pin", () => {
    const rowMin = segmentListRowMinHeightPx(70);
    const stride = segmentListItemStridePx(rowMin);
    const displayCount = SEGMENT_LIST_VIRTUALIZE_MIN_COUNT + 20;
    const root = createScrollRoot(0, 400, displayCount * stride);

    const win = computeEditorSegmentListVirtualWindow({
      segmentListRoot: root,
      scrollMetricsRef: { current: { scrollTop: 0, viewportHeight: 400 } },
      selectedDisplayIndex: 55,
      displayCount,
      itemStridePx: stride,
      useVirtualList: true,
      source: "list",
    });

    expect(win.startIndex).toBeLessThanOrEqual(55);
    expect(win.endIndex).toBeGreaterThan(55);
  });

  it("uses listKeyboard coordinator pin when source is listKeyboard", () => {
    const rowMin = segmentListRowMinHeightPx(70);
    const stride = segmentListItemStridePx(rowMin);
    const displayCount = SEGMENT_LIST_VIRTUALIZE_MIN_COUNT + 20;
    const root = createScrollRoot(0, 400, displayCount * stride);

    pinListKeyboardVirtualDisplayIndex(50);

    const win = computeEditorSegmentListVirtualWindow({
      segmentListRoot: root,
      scrollMetricsRef: { current: { scrollTop: 0, viewportHeight: 400 } },
      selectedDisplayIndex: 50,
      displayCount,
      itemStridePx: stride,
      useVirtualList: true,
      source: "listKeyboard",
    });

    expect(win.startIndex).toBeLessThanOrEqual(50);
    expect(win.endIndex).toBeGreaterThan(50);
  });
});
