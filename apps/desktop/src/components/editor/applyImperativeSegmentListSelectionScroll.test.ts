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

  it("waveform scrolls list into view synchronously and marks layout skip key", () => {
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
});
