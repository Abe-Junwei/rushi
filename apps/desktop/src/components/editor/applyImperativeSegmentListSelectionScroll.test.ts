import { describe, expect, it, afterEach } from "vitest";
import {
  readListKeyboardVirtualDisplayPin,
  resetListKeyboardBurstCoordinatorForTests,
  shouldSkipLayoutScrollForListKeyboard,
} from "../../services/selection/listKeyboardBurstCoordinator";
import {
  segmentListItemStridePx,
  segmentListRowMinHeightPx,
} from "../../utils/segmentListVirtualWindow";
import { applyImperativeSegmentListSelectionScroll } from "./applyImperativeSegmentListSelectionScroll";

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

describe("applyImperativeSegmentListSelectionScroll", () => {
  afterEach(() => {
    resetListKeyboardBurstCoordinatorForTests();
  });

  it("waveform scroll marks layout skip key so React layout effect does not duplicate scroll", () => {
    const rowMin = segmentListRowMinHeightPx(70);
    const stride = segmentListItemStridePx(rowMin);
    const viewport = 480;
    const displayCount = 200;
    const index = 40;
    const root = createScrollRoot(0, viewport, displayCount * stride);
    const scrollKey = "file-a:40:40:all:200:0:199";

    const changed = applyImperativeSegmentListSelectionScroll({
      root,
      selectedDisplayIndex: index,
      selectedIdx: index,
      rowMinHeightPx: rowMin,
      itemStridePx: stride,
      useVirtualList: true,
      source: "waveform",
      scrollKey,
      pinVirtualDisplayIndex: false,
    });

    expect(changed).toBe(true);
    expect(root.scrollTop).toBeGreaterThan(0);
    expect(readListKeyboardVirtualDisplayPin()).toBeNull();
    expect(shouldSkipLayoutScrollForListKeyboard(scrollKey)).toBe(true);
  });

  it("listKeyboard burst scroll marks layout skip key and pins virtual display index", () => {
    const rowMin = segmentListRowMinHeightPx(70);
    const stride = segmentListItemStridePx(rowMin);
    const root = createScrollRoot(0, 480, 200 * stride);
    const scrollKey = "file-a:40:40:all:200:0:199";

    applyImperativeSegmentListSelectionScroll({
      root,
      selectedDisplayIndex: 40,
      selectedIdx: 40,
      rowMinHeightPx: rowMin,
      itemStridePx: stride,
      useVirtualList: true,
      source: "listKeyboard",
      scrollKey,
      pinVirtualDisplayIndex: true,
    });

    expect(readListKeyboardVirtualDisplayPin()).toBe(40);
    expect(shouldSkipLayoutScrollForListKeyboard(scrollKey)).toBe(true);
  });
});
