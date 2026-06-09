import { describe, expect, it } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { makeSeg, useTestSegmentMutationController } from "./useSegmentMutationController.testHelpers";

describe("useSegmentMutationController merge/delete", () => {
  it("deleteSegmentAt removes the segment and reindexes", () => {
    const { result } = renderHook(() =>
      useTestSegmentMutationController([
        makeSeg({ text: "a", start_sec: 0, end_sec: 1 }),
        makeSeg({ text: "b", start_sec: 1, end_sec: 2 }),
        makeSeg({ text: "c", start_sec: 2, end_sec: 3 }),
      ]),
    );

    act(() => result.current.mutations.deleteSegmentAt(1));

    expect(result.current.segments).toHaveLength(2);
    expect(result.current.segments[0].text).toBe("a");
    expect(result.current.segments[1].text).toBe("c");
    expect(result.current.segments[1].idx).toBe(1);
  });

  it("deleteSegmentAt clamps selectedIdx when deleting the last segment", () => {
    const { result } = renderHook(() =>
      useTestSegmentMutationController([
        makeSeg({ text: "a", start_sec: 0, end_sec: 1 }),
        makeSeg({ text: "b", start_sec: 1, end_sec: 2 }),
      ]),
    );
    act(() => result.current.mutations.deleteSegmentAt(1));
    expect(result.current.selectedIdx).toBe(0);
  });

  it("mergeWithNextAt merges adjacent segments", () => {
    const { result } = renderHook(() =>
      useTestSegmentMutationController([
        makeSeg({ text: "hello", start_sec: 0, end_sec: 1 }),
        makeSeg({ text: "world", start_sec: 1, end_sec: 2 }),
      ]),
    );

    act(() => result.current.mutations.mergeWithNextAt(0));

    expect(result.current.segments).toHaveLength(1);
    expect(result.current.segments[0].text).toBe("hello\nworld");
    expect(result.current.segments[0].start_sec).toBe(0);
    expect(result.current.segments[0].end_sec).toBe(2);
  });

  it("mergeWithPrevAt merges towards previous segment", () => {
    const { result } = renderHook(() =>
      useTestSegmentMutationController([
        makeSeg({ text: "hello", start_sec: 0, end_sec: 1 }),
        makeSeg({ text: "world", start_sec: 1, end_sec: 2 }),
      ]),
    );

    act(() => result.current.mutations.mergeWithPrevAt(1));

    expect(result.current.segments).toHaveLength(1);
    expect(result.current.selectedIdx).toBe(0);
  });

  it("mergeSegmentRange folds contiguous segments", () => {
    const { result } = renderHook(() =>
      useTestSegmentMutationController([
        makeSeg({ text: "a", start_sec: 0, end_sec: 1 }),
        makeSeg({ text: "b", start_sec: 1, end_sec: 2 }),
        makeSeg({ text: "c", start_sec: 2, end_sec: 3 }),
      ]),
    );

    act(() => result.current.mutations.mergeSegmentRange(0, 2));

    expect(result.current.segments).toHaveLength(1);
    expect(result.current.segments[0].text).toBe("a\nb\nc");
    expect(result.current.selectedIdx).toBe(0);
  });

  it("deleteSegmentRange removes contiguous segments", () => {
    const { result } = renderHook(() =>
      useTestSegmentMutationController([
        makeSeg({ text: "a", start_sec: 0, end_sec: 1 }),
        makeSeg({ text: "b", start_sec: 1, end_sec: 2 }),
        makeSeg({ text: "c", start_sec: 2, end_sec: 3 }),
        makeSeg({ text: "d", start_sec: 3, end_sec: 4 }),
      ]),
    );

    act(() => {
      result.current.mutations.deleteSegmentRange(1, 2);
    });

    expect(result.current.segments).toHaveLength(2);
    expect(result.current.segments.map((s) => s.text)).toEqual(["a", "d"]);
    expect(result.current.selectedIdx).toBe(0);
  });

  it("deleteSegmentIndices removes sparse selection and maps selectedIdx", () => {
    const { result } = renderHook(() =>
      useTestSegmentMutationController([
        makeSeg({ text: "a", start_sec: 0, end_sec: 1 }),
        makeSeg({ text: "b", start_sec: 1, end_sec: 2 }),
        makeSeg({ text: "c", start_sec: 2, end_sec: 3 }),
        makeSeg({ text: "d", start_sec: 3, end_sec: 4 }),
        makeSeg({ text: "e", start_sec: 4, end_sec: 5 }),
      ]),
    );

    act(() => {
      result.current.setSelectedIdx(4);
    });
    act(() => {
      result.current.mutations.deleteSegmentIndices([1, 3]);
    });

    expect(result.current.segments.map((s) => s.text)).toEqual(["a", "c", "e"]);
    expect(result.current.selectedIdx).toBe(2);
  });

  it("deleteSegmentIndices keeps selectedIdx when primary not removed", () => {
    const { result } = renderHook(() =>
      useTestSegmentMutationController([
        makeSeg({ text: "a", start_sec: 0, end_sec: 1 }),
        makeSeg({ text: "b", start_sec: 1, end_sec: 2 }),
        makeSeg({ text: "c", start_sec: 2, end_sec: 3 }),
        makeSeg({ text: "d", start_sec: 3, end_sec: 4 }),
      ]),
    );

    act(() => {
      result.current.setSelectedIdx(2);
    });
    act(() => {
      result.current.mutations.deleteSegmentIndices([0, 1]);
    });

    expect(result.current.segments.map((s) => s.text)).toEqual(["c", "d"]);
    expect(result.current.selectedIdx).toBe(0);
  });
});
