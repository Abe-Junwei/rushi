import { describe, expect, it } from "vitest";
import { resolveSegmentTextContextMenuAction } from "./segmentTextContextMenuSelection";

describe("resolveSegmentTextContextMenuAction", () => {
  it("opens row menu when selection was collapsed before context menu (browser auto-select)", () => {
    expect(
      resolveSegmentTextContextMenuAction({
        wasCollapsedBeforeContextMenu: true,
        selectionStart: 4,
        selectionEnd: 5,
        value: "你好。",
      }),
    ).toEqual({ kind: "row" });
  });

  it("opens correction memory when user had a range before right-click", () => {
    expect(
      resolveSegmentTextContextMenuAction({
        wasCollapsedBeforeContextMenu: false,
        selectionStart: 0,
        selectionEnd: 2,
        value: "你好。",
      }),
    ).toEqual({ kind: "correctionMemory", selectionText: "你好" });
  });

  it("opens row menu for whitespace-only selection", () => {
    expect(
      resolveSegmentTextContextMenuAction({
        wasCollapsedBeforeContextMenu: false,
        selectionStart: 0,
        selectionEnd: 1,
        value: " a",
      }),
    ).toEqual({ kind: "row" });
  });
});
