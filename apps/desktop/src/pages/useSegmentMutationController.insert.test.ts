import { describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { makeSeg, useTestSegmentMutationController } from "./useSegmentMutationController.testHelpers";

describe("useSegmentMutationController insert", () => {
  it("insertSegmentAfter creates a new segment in the gap", () => {
    const { result } = renderHook(() =>
      useTestSegmentMutationController([
        makeSeg({ text: "a", start_sec: 0, end_sec: 1 }),
        makeSeg({ text: "b", start_sec: 2, end_sec: 3 }),
      ]),
    );

    act(() => result.current.mutations.insertSegmentAfter(0));

    expect(result.current.segments).toHaveLength(3);
    expect(result.current.segments[1].start_sec).toBe(1);
    expect(result.current.segments[1].text).toBe("");
    expect(result.current.segments[1].text_stage).toBe("manual_transcribe");
    expect(result.current.selectedIdx).toBe(1);
  });

  it("insertSegmentAfter errors when gap is too small", () => {
    const { result } = renderHook(() =>
      useTestSegmentMutationController([
        makeSeg({ text: "a", start_sec: 0, end_sec: 1 }),
        makeSeg({ text: "b", start_sec: 1.05, end_sec: 2 }),
      ]),
    );

    act(() => result.current.mutations.insertSegmentAfter(0));

    expect(result.current.segments).toHaveLength(2);
    expect(result.current.error).toContain("无足够间隙");
  });

  it("insertSegmentFromTimeRange creates segment when no overlap", () => {
    const { result } = renderHook(() =>
      useTestSegmentMutationController([
        makeSeg({ text: "a", start_sec: 0, end_sec: 1 }),
        makeSeg({ text: "b", start_sec: 3, end_sec: 4 }),
      ]),
    );

    let createdIdx = -1;
    act(() => {
      createdIdx = result.current.mutations.insertSegmentFromTimeRange(1.5, 2.5) ?? -1;
    });

    expect(createdIdx).toBe(1);

    expect(result.current.segments).toHaveLength(3);
    expect(result.current.segments[1].start_sec).toBe(1.5);
    expect(result.current.segments[1].end_sec).toBe(2.5);
    expect(result.current.segments[1].text_stage).toBe("manual_transcribe");
    expect(result.current.selectedIdx).toBe(1);
  });

  it("insertSegmentFromTimeRange errors on overlap", () => {
    const { result } = renderHook(() =>
      useTestSegmentMutationController([makeSeg({ text: "a", start_sec: 0, end_sec: 2 })]),
    );

    act(() => {
      void result.current.mutations.insertSegmentFromTimeRange(0.5, 1.5);
    });

    expect(result.current.segments).toHaveLength(1);
    expect(result.current.error).toContain("重叠");
  });

  it("insertSegmentFromTimeRange ignores whole-track placeholder when duration is known", () => {
    const { result } = renderHook(() =>
      useTestSegmentMutationController([
        makeSeg({ text: "placeholder", start_sec: 0, end_sec: 100 }),
        makeSeg({ text: "a", start_sec: 5, end_sec: 8 }),
      ]),
    );

    act(() => {
      void result.current.mutations.insertSegmentFromTimeRange(20, 25, 100);
    });

    expect(result.current.error).toBe("");
    expect(result.current.segments).toHaveLength(3);
    expect(result.current.segments.some((s) => s.start_sec === 20 && s.end_sec === 25)).toBe(true);
  });

  it("insertSegmentFromTimeRange still blocks overlap with a real segment when duration is known", () => {
    const { result } = renderHook(() =>
      useTestSegmentMutationController([
        makeSeg({ text: "placeholder", start_sec: 0, end_sec: 100 }),
        makeSeg({ text: "a", start_sec: 20, end_sec: 30 }),
      ]),
    );

    act(() => {
      void result.current.mutations.insertSegmentFromTimeRange(22, 26, 100);
    });

    expect(result.current.error).toContain("重叠");
    expect(result.current.segments).toHaveLength(2);
  });

  it("insertSegmentFromTimeRange with allow policy creates an overlapping segment", () => {
    const { result } = renderHook(() =>
      useTestSegmentMutationController([makeSeg({ text: "a", start_sec: 0, end_sec: 2 })]),
    );

    act(() => {
      void result.current.mutations.insertSegmentFromTimeRange(0.5, 1.5, 0, "allow");
    });

    expect(result.current.error).toBe("");
    expect(result.current.segments).toHaveLength(2);
    expect(result.current.segments.some((s) => s.start_sec === 0.5 && s.end_sec === 1.5)).toBe(true);
  });

  it("insertSegmentFromTimeRange trims sub-epsilon bleed in a gap", () => {
    const { result } = renderHook(() =>
      useTestSegmentMutationController([
        makeSeg({ text: "a", start_sec: 0, end_sec: 2 }),
        makeSeg({ text: "b", start_sec: 3, end_sec: 5 }),
      ]),
    );

    act(() => {
      void result.current.mutations.insertSegmentFromTimeRange(1.97, 2.12);
    });

    expect(result.current.segments).toHaveLength(3);
    expect(result.current.segments[1].start_sec).toBe(2);
    expect(result.current.segments[1].end_sec).toBe(2.12);
    expect(result.current.error).toBe("");
  });

  it("insertSegmentAfter invokes onSelectionCollapsed", () => {
    const onSelectionCollapsed = vi.fn();
    const { result } = renderHook(() =>
      useTestSegmentMutationController(
        [
          makeSeg({ text: "a", start_sec: 0, end_sec: 1 }),
          makeSeg({ text: "b", start_sec: 2, end_sec: 3 }),
        ],
        false,
        onSelectionCollapsed,
      ),
    );

    act(() => result.current.mutations.insertSegmentAfter(0));

    expect(onSelectionCollapsed).toHaveBeenCalledWith(1);
  });

  it("splitAtSelection invokes onSelectionCollapsed", () => {
    const onSelectionCollapsed = vi.fn();
    const { result } = renderHook(() =>
      useTestSegmentMutationController(
        [makeSeg({ text: "hello world", start_sec: 0, end_sec: 2 })],
        false,
        onSelectionCollapsed,
      ),
    );

    act(() => result.current.mutations.splitAtSelection(0));

    expect(onSelectionCollapsed).toHaveBeenCalledWith(1);
  });
});
