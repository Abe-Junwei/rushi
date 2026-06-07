/** @vitest-environment jsdom */
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  EDITOR_WORKSPACE_SIDEBAR_COLLAPSED_KEY,
  useWorkspaceSidebarCollapse,
} from "./useWorkspaceSidebarCollapse";

describe("useWorkspaceSidebarCollapse", () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
      clear: () => {
        storage.clear();
      },
    });
  });

  it("defaults to expanded when storage empty", () => {
    const { result } = renderHook(() => useWorkspaceSidebarCollapse());
    expect(result.current.collapsed).toBe(false);
  });

  it("reads persisted collapsed state", () => {
    storage.set(EDITOR_WORKSPACE_SIDEBAR_COLLAPSED_KEY, "1");
    const { result } = renderHook(() => useWorkspaceSidebarCollapse());
    expect(result.current.collapsed).toBe(true);
  });

  it("persists toggle", () => {
    const { result } = renderHook(() => useWorkspaceSidebarCollapse());
    act(() => {
      result.current.toggleCollapsed();
    });
    expect(result.current.collapsed).toBe(true);
    expect(storage.get(EDITOR_WORKSPACE_SIDEBAR_COLLAPSED_KEY)).toBe("1");
  });
});
