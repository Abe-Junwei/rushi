/** @vitest-environment jsdom */
import { renderHook, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEditorFooterShortcutHintRotation } from "./useEditorFooterShortcutHintRotation";
import { EDITOR_FOOTER_SHORTCUT_HINTS } from "../utils/editorFooterShortcutHints";

describe("useEditorFooterShortcutHintRotation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns empty string when disabled", () => {
    const { result } = renderHook(() => useEditorFooterShortcutHintRotation(false));
    expect(result.current).toBe("");
  });

  it("rotates hints on interval when enabled", () => {
    const { result } = renderHook(() => useEditorFooterShortcutHintRotation(true, 1000));
    const first = result.current;
    expect(first.length).toBeGreaterThan(0);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current).not.toBe(first);
    const allKeys = EDITOR_FOOTER_SHORTCUT_HINTS.map((h) => h.keys);
    expect(allKeys).toContain("⌘/Ctrl + S");
    expect(allKeys).toContain("Tab");
    expect(allKeys).toContain("Enter");
  });
});
