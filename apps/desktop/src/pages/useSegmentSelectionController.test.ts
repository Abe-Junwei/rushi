import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useState } from "react";
import { useSegmentSelectionController } from "./useSegmentSelectionController";

function useTestSelection(initialIdx = 0, segmentCount = 6) {
  const [selectedIdx, setSelectedIdx] = useState(initialIdx);
  const api = useSegmentSelectionController({
    selectedIdx,
    setSelectedIdx,
    segmentCount,
    resetKey: "file-a",
  });
  return { selectedIdx, setSelectedIdx, ...api };
}

describe("useSegmentSelectionController", () => {
  it("extends selection on shift+click without collapsing on selectedIdx sync", () => {
    const { result } = renderHook(() => useTestSelection(2, 6));

    act(() => {
      result.current.selectSegmentAt(5, { shiftKey: true });
    });

    expect(result.current.selectedIdx).toBe(5);
    expect(result.current.selectionLo).toBe(2);
    expect(result.current.selectionHi).toBe(5);
    expect(result.current.selectionCount).toBe(4);
    expect(result.current.isMultiSegmentSelection).toBe(true);
    expect(result.current.isIndexInSelection(3)).toBe(true);
  });

  it("selectSegmentRange keeps the full range visible", () => {
    const { result } = renderHook(() => useTestSelection(0, 6));

    act(() => {
      result.current.selectSegmentRange(1, 4);
    });

    expect(result.current.selectionLo).toBe(1);
    expect(result.current.selectionHi).toBe(4);
    expect(result.current.selectedIdx).toBe(4);
    expect(result.current.isMultiSegmentSelection).toBe(true);
  });

  it("preserves multi-select when selectedIdx changes within the set", () => {
    const { result } = renderHook(() => useTestSelection(2, 6));

    act(() => {
      result.current.selectSegmentAt(5, { shiftKey: true });
    });
    act(() => {
      result.current.setSelectedIdx(3);
    });

    expect(result.current.selectionLo).toBe(2);
    expect(result.current.selectionHi).toBe(5);
    expect(result.current.isMultiSegmentSelection).toBe(true);
  });

  it("replaces selection on plain click", () => {
    const { result } = renderHook(() => useTestSelection(2, 6));

    act(() => {
      result.current.selectSegmentAt(5, { shiftKey: true });
    });
    act(() => {
      result.current.selectSegmentAt(1);
    });

    expect(result.current.selectionLo).toBe(1);
    expect(result.current.selectionHi).toBe(1);
    expect(result.current.selectedIdx).toBe(1);
  });

  it("collapseTo clears multi-select range", () => {
    const { result } = renderHook(() => useTestSelection(0, 6));

    act(() => {
      result.current.selectSegmentRange(0, 3);
    });
    act(() => {
      result.current.collapseTo(3);
    });

    expect(result.current.isMultiSegmentSelection).toBe(false);
    expect(result.current.selectionLo).toBe(3);
    expect(result.current.selectionHi).toBe(3);
  });

  it("clearMultiSelection collapses to primary only", () => {
    const { result } = renderHook(() => useTestSelection(0, 6));

    act(() => {
      result.current.selectSegmentRange(0, 3);
    });
    act(() => {
      result.current.clearMultiSelection();
    });

    expect(result.current.isMultiSegmentSelection).toBe(false);
    expect(result.current.selectionCount).toBe(1);
    expect(result.current.selectedIdx).toBe(3);
    expect(result.current.isIndexInSelection(3)).toBe(true);
  });

  it("toggle adds and removes indices like Jieyu toggleSegmentSelection", () => {
    const { result } = renderHook(() => useTestSelection(0, 6));

    act(() => {
      result.current.selectSegmentAt(2);
    });
    act(() => {
      result.current.selectSegmentAt(4, { toggle: true });
    });

    expect(result.current.selectionCount).toBe(2);
    expect(result.current.isIndexInSelection(2)).toBe(true);
    expect(result.current.isIndexInSelection(4)).toBe(true);
    expect(result.current.isContiguousSelection).toBe(false);

    act(() => {
      result.current.selectSegmentAt(4, { toggle: true });
    });

    expect(result.current.selectionCount).toBe(1);
    expect(result.current.isIndexInSelection(2)).toBe(true);
  });
});
