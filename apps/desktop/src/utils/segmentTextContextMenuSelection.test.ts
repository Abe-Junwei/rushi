import { describe, expect, it } from "vitest";
import {
  resolveSegmentTextContextMenuAction,
  restoreSegmentTextContextMenuSelection,
} from "./segmentTextContextMenuSelection";

describe("resolveSegmentTextContextMenuAction", () => {
  it("opens text menu without correction selection when snapshot was collapsed", () => {
    expect(
      resolveSegmentTextContextMenuAction({
        snapshot: { start: 4, end: 4, collapsed: true },
        value: "你好。",
      }),
    ).toEqual({ kind: "textMenu", selectionText: "" });
  });

  it("passes selection text when user had a range before right-click", () => {
    expect(
      resolveSegmentTextContextMenuAction({
        snapshot: { start: 0, end: 2, collapsed: false },
        value: "你好。",
      }),
    ).toEqual({ kind: "textMenu", selectionText: "你好" });
  });

  it("ignores contextmenu-time auto selection without pointerdown snapshot", () => {
    expect(
      resolveSegmentTextContextMenuAction({
        snapshot: null,
        value: "你好。",
      }),
    ).toEqual({ kind: "textMenu", selectionText: "" });
  });

  it("opens text menu with empty selection for whitespace-only range", () => {
    expect(
      resolveSegmentTextContextMenuAction({
        snapshot: { start: 0, end: 1, collapsed: false },
        value: " a",
      }),
    ).toEqual({ kind: "textMenu", selectionText: "" });
  });
});

describe("restoreSegmentTextContextMenuSelection", () => {
  it("restores collapsed caret from snapshot", () => {
    const textarea = document.createElement("textarea");
    textarea.value = "你好。";
    textarea.setSelectionRange(2, 3);
    restoreSegmentTextContextMenuSelection(textarea, { start: 0, end: 0, collapsed: true });
    expect(textarea.selectionStart).toBe(0);
    expect(textarea.selectionEnd).toBe(0);
  });

  it("restores deliberate range from snapshot", () => {
    const textarea = document.createElement("textarea");
    textarea.value = "你好。";
    textarea.setSelectionRange(2, 2);
    restoreSegmentTextContextMenuSelection(textarea, { start: 0, end: 2, collapsed: false });
    expect(textarea.selectionStart).toBe(0);
    expect(textarea.selectionEnd).toBe(2);
  });

  it("blurs focused textarea so custom context menu clicks are not stolen", () => {
    const textarea = document.createElement("textarea");
    document.body.appendChild(textarea);
    textarea.focus();
    expect(document.activeElement).toBe(textarea);
    restoreSegmentTextContextMenuSelection(textarea, { start: 0, end: 0, collapsed: true });
    expect(document.activeElement).not.toBe(textarea);
    document.body.removeChild(textarea);
  });
});
