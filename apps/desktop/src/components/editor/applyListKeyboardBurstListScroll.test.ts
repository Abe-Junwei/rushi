// @vitest-environment jsdom

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  registerListKeyboardScrollEpochNotifier,
  resetListKeyboardBurstCoordinatorForTests,
  readListKeyboardVirtualDisplayPin,
} from "../../services/selection/listKeyboardBurstCoordinator";
import {
  segmentListItemStridePx,
  segmentListRowMinHeightPx,
} from "../../utils/segmentListVirtualWindow";

vi.mock("./planEditorSegmentListSelectionScroll", () => ({
  planEditorSegmentListSelectionScroll: vi.fn(() => ({ kind: "skip" as const })),
}));

import { applyListKeyboardBurstListScroll } from "./applyListKeyboardBurstListScroll";

describe("applyListKeyboardBurstListScroll", () => {
  beforeEach(() => {
    resetListKeyboardBurstCoordinatorForTests();
  });

  afterEach(() => {
    resetListKeyboardBurstCoordinatorForTests();
  });

  it("bumps scroll epoch on skip when row already in viewport (pin without scrollTop change)", () => {
    const rowMin = segmentListRowMinHeightPx(70);
    const stride = segmentListItemStridePx(rowMin);
    const root = document.createElement("div");
    const selectedDisplayIndex = 3;

    const notifier = vi.fn();
    registerListKeyboardScrollEpochNotifier(notifier);

    const changed = applyListKeyboardBurstListScroll({
      root,
      selectedDisplayIndex,
      selectedIdx: selectedDisplayIndex,
      rowMinHeightPx: rowMin,
      itemStridePx: stride,
      useVirtualList: true,
      scrollKey: `f1:${selectedDisplayIndex}:${selectedDisplayIndex}:all`,
    });

    expect(changed).toBe(false);
    expect(readListKeyboardVirtualDisplayPin()).toBe(selectedDisplayIndex);
    expect(notifier).toHaveBeenCalledWith({ sync: true, force: true });
  });
});
