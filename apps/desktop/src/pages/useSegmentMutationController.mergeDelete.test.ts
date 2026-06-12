import { describe, expect, it } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { makeSeg, useTestSegmentMutationController } from "./useSegmentMutationController.testHelpers";
import { segmentDraftKey, segmentDraftStore } from "../hooks/useSegmentDraftStore";

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
    expect(result.current.segments[0].text).toBe("hello\nworld");
    expect(result.current.selectedIdx).toBe(0);
  });

  it("mergeWithPrevAt includes uncommitted draft text for current row", () => {
    segmentDraftStore.resetAll();
    const { result } = renderHook(() =>
      useTestSegmentMutationController([
        makeSeg({ text: "hello", start_sec: 0, end_sec: 1, uid: "uid-a" }),
        makeSeg({ text: "world", start_sec: 1, end_sec: 2, uid: "uid-b" }),
      ]),
    );
    const current = result.current.segments[1];
    segmentDraftStore.setDraft(segmentDraftKey(current, 1), "edited tail");

    act(() => result.current.mutations.mergeWithPrevAt(1));

    expect(result.current.segments).toHaveLength(1);
    expect(result.current.segments[0]?.text).toBe("hello\nedited tail");
  });

  it("mergeWithNextAt includes uncommitted draft text for current row", () => {
    segmentDraftStore.resetAll();
    const { result } = renderHook(() =>
      useTestSegmentMutationController([
        makeSeg({ text: "hello", start_sec: 0, end_sec: 1, uid: "uid-a" }),
        makeSeg({ text: "world", start_sec: 1, end_sec: 2, uid: "uid-b" }),
      ]),
    );
    const current = result.current.segments[0];
    segmentDraftStore.setDraft(segmentDraftKey(current, 0), "edited head");

    act(() => result.current.mutations.mergeWithNextAt(0));

    expect(result.current.segments).toHaveLength(1);
    expect(result.current.segments[0]?.text).toBe("edited head\nworld");
  });

  it("mergeWithNextAt reads live DOM textarea when segments lag behind DOM", () => {
    segmentDraftStore.resetAll();
    const { result } = renderHook(() =>
      useTestSegmentMutationController([
        makeSeg({ text: "hello", start_sec: 0, end_sec: 1, uid: "uid-a" }),
        makeSeg({ text: "world", start_sec: 1, end_sec: 2, uid: "uid-b" }),
      ]),
    );

    const row = document.createElement("div");
    row.setAttribute("data-seg-row", "0");
    const textarea = document.createElement("textarea");
    textarea.setAttribute("aria-label", "语段正文");
    textarea.value = "typed in dom only";
    row.appendChild(textarea);
    document.body.appendChild(row);

    act(() => {
      result.current.segmentsRef.current = [
        makeSeg({ text: "typed in dom only", start_sec: 0, end_sec: 1, uid: "uid-a" }),
        makeSeg({ text: "world", start_sec: 1, end_sec: 2, uid: "uid-b" }),
      ];
    });

    act(() => result.current.mutations.mergeWithNextAt(0));

    expect(result.current.segments).toHaveLength(1);
    expect(result.current.segments[0]?.text).toBe("typed in dom only\nworld");

    row.remove();
  });

  it("mergeWithNextAt includes drafts on both adjacent segments", () => {
    segmentDraftStore.resetAll();
    const { result } = renderHook(() =>
      useTestSegmentMutationController([
        makeSeg({ text: "hello", start_sec: 0, end_sec: 1, uid: "uid-a" }),
        makeSeg({ text: "world", start_sec: 1, end_sec: 2, uid: "uid-b" }),
      ]),
    );
    const left = result.current.segments[0];
    const right = result.current.segments[1];
    segmentDraftStore.setDraft(segmentDraftKey(left, 0), "edited head");
    segmentDraftStore.setDraft(segmentDraftKey(right, 1), "edited tail");

    act(() => result.current.mutations.mergeWithNextAt(0));

    expect(result.current.segments).toHaveLength(1);
    expect(result.current.segments[0]?.text).toBe("edited head\nedited tail");
  });

  it("mergeWithPrevAt includes draft on the previous segment when merging from later row", () => {
    segmentDraftStore.resetAll();
    const { result } = renderHook(() =>
      useTestSegmentMutationController([
        makeSeg({ text: "hello", start_sec: 0, end_sec: 1, uid: "uid-a" }),
        makeSeg({ text: "world", start_sec: 1, end_sec: 2, uid: "uid-b" }),
      ]),
    );
    const prev = result.current.segments[0];
    segmentDraftStore.setDraft(segmentDraftKey(prev, 0), "edited prev");

    act(() => result.current.mutations.mergeWithPrevAt(1));

    expect(result.current.segments).toHaveLength(1);
    expect(result.current.segments[0]?.text).toBe("edited prev\nworld");
  });

  it("mergeSegmentRange includes drafts on all folded segments", () => {
    segmentDraftStore.resetAll();
    const { result } = renderHook(() =>
      useTestSegmentMutationController([
        makeSeg({ text: "a", start_sec: 0, end_sec: 1, uid: "uid-a" }),
        makeSeg({ text: "b", start_sec: 1, end_sec: 2, uid: "uid-b" }),
        makeSeg({ text: "c", start_sec: 2, end_sec: 3, uid: "uid-c" }),
      ]),
    );
    const rows = result.current.segments;
    segmentDraftStore.setDraft(segmentDraftKey(rows[0], 0), "A");
    segmentDraftStore.setDraft(segmentDraftKey(rows[1], 1), "B");
    segmentDraftStore.setDraft(segmentDraftKey(rows[2], 2), "C");

    act(() => result.current.mutations.mergeSegmentRange(0, 2));

    expect(result.current.segments).toHaveLength(1);
    expect(result.current.segments[0]?.text).toBe("A\nB\nC");
  });

  it("mergeWithNextAt uses segmentsRef when React state lags behind ref", () => {
    segmentDraftStore.resetAll();
    const { result } = renderHook(() =>
      useTestSegmentMutationController([
        makeSeg({ text: "hello", start_sec: 0, end_sec: 1, uid: "uid-a" }),
        makeSeg({ text: "world", start_sec: 1, end_sec: 2, uid: "uid-b" }),
      ]),
    );

    act(() => {
      result.current.segmentsRef.current = [
        makeSeg({ text: "edited head", start_sec: 0, end_sec: 1, uid: "uid-a" }),
        makeSeg({ text: "world", start_sec: 1, end_sec: 2, uid: "uid-b" }),
      ];
    });

    act(() => result.current.mutations.mergeWithNextAt(0));

    expect(result.current.segments).toHaveLength(1);
    expect(result.current.segments[0]?.text).toBe("edited head\nworld");
  });

  it("mergeWithNextAt preserves materialized text on unrelated segments after reindex", () => {
    segmentDraftStore.resetAll();
    const { result } = renderHook(() =>
      useTestSegmentMutationController([
        makeSeg({ text: "a", start_sec: 0, end_sec: 1, uid: "uid-a" }),
        makeSeg({ text: "b", start_sec: 1, end_sec: 2, uid: "uid-b" }),
        makeSeg({ text: "c", start_sec: 2, end_sec: 3, uid: "uid-c" }),
        makeSeg({ text: "d", start_sec: 3, end_sec: 4, uid: "uid-d" }),
      ]),
    );
    const tail = result.current.segments[3];
    segmentDraftStore.setDraft(segmentDraftKey(tail, 3), "edited tail");

    act(() => result.current.mutations.mergeWithNextAt(0));

    expect(result.current.segments).toHaveLength(3);
    expect(result.current.segments[2]?.text).toBe("edited tail");
    expect(segmentDraftStore.getDraft(segmentDraftKey(result.current.segments[2], 2))).toBeUndefined();
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

  it("deleteSegmentIndices with single index undo restores full list in one step", () => {
    const { result } = renderHook(() =>
      useTestSegmentMutationController([
        makeSeg({ text: "a", start_sec: 0, end_sec: 1 }),
        makeSeg({ text: "b", start_sec: 1, end_sec: 2 }),
        makeSeg({ text: "c", start_sec: 2, end_sec: 3 }),
      ]),
    );

    act(() => {
      result.current.mutations.deleteSegmentIndices([1]);
    });
    expect(result.current.segments).toHaveLength(2);

    act(() => {
      result.current.mutations.undo();
    });
    expect(result.current.segments).toHaveLength(3);
    expect(result.current.segments.map((s) => s.text)).toEqual(["a", "b", "c"]);
  });
});
