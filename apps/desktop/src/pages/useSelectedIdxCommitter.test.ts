import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useSelectedIdxCommitter } from "./useSelectedIdxCommitter";

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

describe("useSelectedIdxCommitter", () => {
  it("commits waveform and list selection through startTransition", () => {
    (globalThis as { __rushiTransitionCalls?: number }).__rushiTransitionCalls = 0;
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
});
