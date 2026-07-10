import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useSelectedIdxCommitter } from "./useSelectedIdxCommitter";
import {
  isSelectionLatencyProfileEnabled,
  readRecentSelectionLatencyProfileLines,
  resetSelectionLatencyProfileForTests,
  selectionProfileBegin,
  selectionProfileFlush,
  setSelectionLatencyProfileEnabled,
} from "../services/ui/selectionLatencyProfile";

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    startTransition: (cb: () => void) => {
      (globalThis as { __rushiTransitionCalls?: number }).__rushiTransitionCalls =
        ((globalThis as { __rushiTransitionCalls?: number }).__rushiTransitionCalls ?? 0) + 1;
      cb();
    },
  };
});

vi.mock("../services/desktopUiLog", () => ({
  logDesktopUi: vi.fn(),
}));

describe("useSelectedIdxCommitter", () => {
  beforeEach(() => {
    resetSelectionLatencyProfileForTests();
    const data = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => data.get(key) ?? null,
        setItem: (key: string, value: string) => {
          data.set(key, value);
        },
        removeItem: (key: string) => {
          data.delete(key);
        },
        clear: () => data.clear(),
      },
    });
    setSelectionLatencyProfileEnabled(false);
    (globalThis as { __rushiTransitionCalls?: number }).__rushiTransitionCalls = 0;
  });

  afterEach(() => {
    resetSelectionLatencyProfileForTests();
    setSelectionLatencyProfileEnabled(false);
  });

  it("commits waveform and list selection through startTransition", () => {
    const setSelectedIdxUi = vi.fn();
    const { result } = renderHook(() => useSelectedIdxCommitter(setSelectedIdxUi));

    result.current(3, "waveform");
    result.current(4, "list");
    result.current(5, "listAdvance");

    expect(setSelectedIdxUi).toHaveBeenCalledTimes(3);
    expect(setSelectedIdxUi).toHaveBeenNthCalledWith(1, 3, undefined);
    expect(setSelectedIdxUi).toHaveBeenNthCalledWith(2, 4, undefined);
    expect(setSelectedIdxUi).toHaveBeenNthCalledWith(3, 5, undefined);
    expect((globalThis as { __rushiTransitionCalls?: number }).__rushiTransitionCalls).toBe(3);
  });

  it("records listCommit inside startTransition without flushing", () => {
    setSelectionLatencyProfileEnabled(true);
    expect(isSelectionLatencyProfileEnabled()).toBe(true);
    const setSelectedIdxUi = vi.fn();
    const { result } = renderHook(() => useSelectedIdxCommitter(setSelectedIdxUi));

    selectionProfileBegin("waveform idx=3 segments=62");
    result.current(3, "waveform");

    expect(setSelectedIdxUi).toHaveBeenCalledWith(3, undefined);
    expect(readRecentSelectionLatencyProfileLines()).toHaveLength(0);

    selectionProfileFlush();
    const lines = readRecentSelectionLatencyProfileLines();
    expect(lines.some((line) => /listCommit=[\d.]+ms/.test(line))).toBe(true);
    expect(lines.some((line) => /total=[\d.]+ms/.test(line))).toBe(true);
  });
});
