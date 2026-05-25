import { describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSegmentDirtyState } from "./useSegmentDirtyState";
import type { SegmentDto } from "../tauri/projectApi";

function seg(text: string, idx = 0): SegmentDto {
  return { idx, start_sec: 0, end_sec: 1, text };
}

describe("useSegmentDirtyState", () => {
  it("reports no dirty when snapshot matches", () => {
    const segmentsRef = { current: [seg("a")] };
    const flush = vi.fn();
    const { result } = renderHook(() =>
      useSegmentDirtyState({
        currentFileId: "f1",
        segmentsRef,
        flushSegmentTextDrafts: flush,
      }),
    );
    act(() => result.current.markSegmentsSaved());
    expect(result.current.hasUnsavedSegmentChanges()).toBe(false);
    expect(flush).toHaveBeenCalled();
  });

  it("reports dirty after text change", () => {
    const segmentsRef = { current: [seg("a")] };
    const { result } = renderHook(() =>
      useSegmentDirtyState({
        currentFileId: "f1",
        segmentsRef,
        flushSegmentTextDrafts: vi.fn(),
      }),
    );
    act(() => result.current.markSegmentsSaved());
    segmentsRef.current = [seg("b")];
    expect(result.current.hasUnsavedSegmentChanges()).toBe(true);
  });

  it("confirmDiscard returns true when clean", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const segmentsRef = { current: [seg("x")] };
    const { result } = renderHook(() =>
      useSegmentDirtyState({
        currentFileId: "f1",
        segmentsRef,
        flushSegmentTextDrafts: vi.fn(),
      }),
    );
    act(() => result.current.markSegmentsSaved());
    expect(result.current.confirmDiscardUnsavedIfNeeded()).toBe(true);
    expect(confirmSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });
});
