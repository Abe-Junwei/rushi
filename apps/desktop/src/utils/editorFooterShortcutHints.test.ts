import { describe, expect, it } from "vitest";
import {
  EDITOR_FOOTER_SHORTCUT_HINTS,
  formatEditorFooterShortcutHint,
} from "./editorFooterShortcutHints";

describe("editorFooterShortcutHints", () => {
  it("formats compact footer hint lines", () => {
    const hint = EDITOR_FOOTER_SHORTCUT_HINTS.find((h) => h.keys.includes("⌘/Ctrl + F"));
    expect(hint).toBeTruthy();
    expect(formatEditorFooterShortcutHint(hint!)).toContain("查找与替换");
  });

  it("includes registry workflow shortcuts", () => {
    const keys = EDITOR_FOOTER_SHORTCUT_HINTS.map((h) => h.keys);
    expect(keys).toContain("⌘/Ctrl + S");
    expect(keys).toContain("Tab / ⌘/Ctrl + Enter");
    expect(keys).toContain("⌘/Ctrl + F");
  });

  it("includes legacy arrow navigation hint", () => {
    const keys = EDITOR_FOOTER_SHORTCUT_HINTS.map((h) => h.keys);
    expect(keys).toContain("↑ / ↓");
  });
});
