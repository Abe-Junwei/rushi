import { describe, expect, it } from "vitest";
import {
  EDITOR_FOOTER_SHORTCUT_HINTS,
  formatEditorFooterShortcutHint,
} from "./editorFooterShortcutHints";

describe("editorFooterShortcutHints", () => {
  it("formats compact footer hint lines", () => {
    const hint = EDITOR_FOOTER_SHORTCUT_HINTS[0];
    expect(formatEditorFooterShortcutHint(hint)).toBe("⌘/Ctrl + Enter · 定稿并跳下一条");
  });
});
