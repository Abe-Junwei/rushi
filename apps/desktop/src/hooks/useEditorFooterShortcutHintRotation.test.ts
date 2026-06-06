/** @vitest-environment jsdom */
import { renderHook, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEditorFooterShortcutHintRotation } from "./useEditorFooterShortcutHintRotation";

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
    expect(first).toContain("⌘/Ctrl + Enter");

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current).not.toBe(first);
    expect(result.current).toContain("⌘/Ctrl + S");
  });
});
