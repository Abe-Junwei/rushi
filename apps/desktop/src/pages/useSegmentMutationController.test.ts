import { describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRef, useState } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import { segmentDraftKey, segmentDraftStore } from "../hooks/useSegmentDraftStore";
import { useSegmentMutationController } from "./useSegmentMutationController";

function makeSeg(props: Partial<SegmentDto> & { text: string; start_sec: number; end_sec: number }): SegmentDto {
  return {
    idx: 0,
    confidence: null,
    low_confidence: false,
    detail: null,
    ...props,
  };
}

function useTestController(
  initial: SegmentDto[],
  busy = false,
  onSelectionCollapsed?: (idx: number) => void,
) {
  const [segments, setSegments] = useState(initial);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const segmentsRef = useRef(segments);
  const selectedIdxRef = useRef(selectedIdx);
  segmentsRef.current = segments;
  selectedIdxRef.current = selectedIdx;
  const [error, setError] = useState("");

  const mutations = useSegmentMutationController({
    segmentsRef,
    setSegments,
    selectedIdxRef,
    setSelectedIdx,
    setError,
    busy,
    onSelectionCollapsed,
  });

  return { mutations, segments, selectedIdx, error };
}

describe("useSegmentMutationController", () => {
  it("undo and redo are ignored while busy", () => {
    const { result } = renderHook(() =>
      useTestController([makeSeg({ text: "b", start_sec: 0, end_sec: 1 })], true),
    );

    act(() => result.current.mutations.undo());

    expect(result.current.segments[0].text).toBe("b");
  });

  it("updateSegmentText is ignored while busy (restore must not be overwritten by blur)", () => {
    const { result } = renderHook(() =>
      useTestController([makeSeg({ text: "restored", start_sec: 0, end_sec: 1 })], true),
    );

    act(() => result.current.mutations.updateSegmentText(0, "stale"));

    expect(result.current.segments[0].text).toBe("restored");
  });

  it("updateSegmentText changes text and preserves other fields", () => {
    const { result } = renderHook(() =>
      useTestController([makeSeg({ text: "hello", start_sec: 0, end_sec: 1 })])
    );

    act(() => result.current.mutations.updateSegmentText(0, "world"));

    expect(result.current.segments[0].text).toBe("world");
    expect(result.current.segments[0].start_sec).toBe(0);
    expect(result.current.segments[0].end_sec).toBe(1);
  });

  it("updateSegmentTime mutates the specified field", () => {
    const { result } = renderHook(() =>
      useTestController([makeSeg({ text: "a", start_sec: 0, end_sec: 1 })])
    );

    act(() => result.current.mutations.updateSegmentTime(0, "start_sec", 0.5));

    expect(result.current.segments[0].start_sec).toBe(0.5);
    expect(result.current.segments[0].end_sec).toBe(1);
  });

  it("deleteSegmentAt removes the segment and reindexes", () => {
    const { result } = renderHook(() =>
      useTestController([
        makeSeg({ text: "a", start_sec: 0, end_sec: 1 }),
        makeSeg({ text: "b", start_sec: 1, end_sec: 2 }),
        makeSeg({ text: "c", start_sec: 2, end_sec: 3 }),
      ])
    );

    act(() => result.current.mutations.deleteSegmentAt(1));

    expect(result.current.segments).toHaveLength(2);
    expect(result.current.segments[0].text).toBe("a");
    expect(result.current.segments[1].text).toBe("c");
    expect(result.current.segments[1].idx).toBe(1);
  });

  it("deleteSegmentAt clamps selectedIdx when deleting the last segment", () => {
    const { result } = renderHook(() =>
      useTestController([
        makeSeg({ text: "a", start_sec: 0, end_sec: 1 }),
        makeSeg({ text: "b", start_sec: 1, end_sec: 2 }),
      ])
    );
    act(() => result.current.mutations.deleteSegmentAt(1));
    expect(result.current.selectedIdx).toBe(0);
  });

  it("mergeWithNextAt merges adjacent segments", () => {
    const { result } = renderHook(() =>
      useTestController([
        makeSeg({ text: "hello", start_sec: 0, end_sec: 1 }),
        makeSeg({ text: "world", start_sec: 1, end_sec: 2 }),
      ])
    );

    act(() => result.current.mutations.mergeWithNextAt(0));

    expect(result.current.segments).toHaveLength(1);
    expect(result.current.segments[0].text).toBe("hello\nworld");
    expect(result.current.segments[0].start_sec).toBe(0);
    expect(result.current.segments[0].end_sec).toBe(2);
  });

  it("mergeWithPrevAt merges towards previous segment", () => {
    const { result } = renderHook(() =>
      useTestController([
        makeSeg({ text: "hello", start_sec: 0, end_sec: 1 }),
        makeSeg({ text: "world", start_sec: 1, end_sec: 2 }),
      ])
    );

    act(() => result.current.mutations.mergeWithPrevAt(1));

    expect(result.current.segments).toHaveLength(1);
    expect(result.current.selectedIdx).toBe(0);
  });

  it("insertSegmentAfter creates a new segment in the gap", () => {
    const { result } = renderHook(() =>
      useTestController([
        makeSeg({ text: "a", start_sec: 0, end_sec: 1 }),
        makeSeg({ text: "b", start_sec: 2, end_sec: 3 }),
      ])
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
      useTestController([
        makeSeg({ text: "a", start_sec: 0, end_sec: 1 }),
        makeSeg({ text: "b", start_sec: 1.05, end_sec: 2 }),
      ])
    );

    act(() => result.current.mutations.insertSegmentAfter(0));

    expect(result.current.segments).toHaveLength(2);
    expect(result.current.error).toContain("无足够间隙");
  });

  it("insertSegmentFromTimeRange creates segment when no overlap", () => {
    const { result } = renderHook(() =>
      useTestController([
        makeSeg({ text: "a", start_sec: 0, end_sec: 1 }),
        makeSeg({ text: "b", start_sec: 3, end_sec: 4 }),
      ])
    );

    act(() => result.current.mutations.insertSegmentFromTimeRange(1.5, 2.5));

    expect(result.current.segments).toHaveLength(3);
    expect(result.current.segments[1].start_sec).toBe(1.5);
    expect(result.current.segments[1].end_sec).toBe(2.5);
    expect(result.current.segments[1].text_stage).toBe("manual_transcribe");
    expect(result.current.selectedIdx).toBe(1);
  });

  it("insertSegmentFromTimeRange errors on overlap", () => {
    const { result } = renderHook(() =>
      useTestController([makeSeg({ text: "a", start_sec: 0, end_sec: 2 })])
    );

    act(() => result.current.mutations.insertSegmentFromTimeRange(0.5, 1.5));

    expect(result.current.segments).toHaveLength(1);
    expect(result.current.error).toContain("重叠");
  });

  it("insertSegmentFromTimeRange ignores whole-track placeholder when duration is known", () => {
    const { result } = renderHook(() =>
      useTestController([
        makeSeg({ text: "placeholder", start_sec: 0, end_sec: 100 }),
        makeSeg({ text: "a", start_sec: 5, end_sec: 8 }),
      ])
    );

    act(() => result.current.mutations.insertSegmentFromTimeRange(20, 25, 100));

    expect(result.current.error).toBe("");
    expect(result.current.segments).toHaveLength(3);
    expect(result.current.segments.some((s) => s.start_sec === 20 && s.end_sec === 25)).toBe(true);
  });

  it("insertSegmentFromTimeRange still blocks overlap with a real segment when duration is known", () => {
    const { result } = renderHook(() =>
      useTestController([
        makeSeg({ text: "placeholder", start_sec: 0, end_sec: 100 }),
        makeSeg({ text: "a", start_sec: 20, end_sec: 30 }),
      ])
    );

    act(() => result.current.mutations.insertSegmentFromTimeRange(22, 26, 100));

    expect(result.current.error).toContain("重叠");
    expect(result.current.segments).toHaveLength(2);
  });

  it("insertSegmentFromTimeRange with allow policy creates an overlapping segment", () => {
    const { result } = renderHook(() =>
      useTestController([makeSeg({ text: "a", start_sec: 0, end_sec: 2 })])
    );

    act(() => result.current.mutations.insertSegmentFromTimeRange(0.5, 1.5, 0, "allow"));

    expect(result.current.error).toBe("");
    expect(result.current.segments).toHaveLength(2);
    expect(result.current.segments.some((s) => s.start_sec === 0.5 && s.end_sec === 1.5)).toBe(true);
  });

  it("insertSegmentFromTimeRange trims sub-epsilon bleed in a gap", () => {
    const { result } = renderHook(() =>
      useTestController([
        makeSeg({ text: "a", start_sec: 0, end_sec: 2 }),
        makeSeg({ text: "b", start_sec: 3, end_sec: 5 }),
      ])
    );

    act(() => result.current.mutations.insertSegmentFromTimeRange(1.97, 2.12));

    expect(result.current.segments).toHaveLength(3);
    expect(result.current.segments[1].start_sec).toBe(2);
    expect(result.current.segments[1].end_sec).toBe(2.12);
    expect(result.current.error).toBe("");
  });

  it("undo flushes draft then restores committed text", () => {
    const seg = makeSeg({ text: "hello", start_sec: 0, end_sec: 1, uid: "u1" });
    const { result } = renderHook(() => useTestController([seg]));
    const key = segmentDraftKey(seg, 0);

    act(() => result.current.mutations.updateSegmentText(0, "world"));
    act(() => {
      segmentDraftStore.setDraft(key, "draft-only");
    });
    act(() => result.current.mutations.undo());

    expect(result.current.segments[0].text).toBe("hello");
    expect(segmentDraftStore.getDraft(key)).toBeUndefined();
  });

  it("undo restores previous state after mutation", () => {
    const { result } = renderHook(() =>
      useTestController([makeSeg({ text: "hello", start_sec: 0, end_sec: 1 })])
    );

    act(() => result.current.mutations.updateSegmentText(0, "world"));
    expect(result.current.segments[0].text).toBe("world");

    act(() => result.current.mutations.undo());
    expect(result.current.segments[0].text).toBe("hello");
  });

  it("redo re-applies undone mutation", () => {
    const { result } = renderHook(() =>
      useTestController([makeSeg({ text: "hello", start_sec: 0, end_sec: 1 })])
    );

    act(() => result.current.mutations.updateSegmentText(0, "world"));
    act(() => result.current.mutations.undo());
    act(() => result.current.mutations.redo());

    expect(result.current.segments[0].text).toBe("world");
  });

  it("resetMutationHistory clears undo/redo stacks", () => {
    const { result } = renderHook(() =>
      useTestController([makeSeg({ text: "hello", start_sec: 0, end_sec: 1 })])
    );

    act(() => result.current.mutations.updateSegmentText(0, "world"));
    act(() => result.current.mutations.resetMutationHistory());
    act(() => result.current.mutations.undo());

    expect(result.current.segments[0].text).toBe("world");
  });

  it("splitAtSelection divides segment at midpoint", () => {
    const { result } = renderHook(() =>
      useTestController([makeSeg({ text: "hello world", start_sec: 0, end_sec: 2 })])
    );

    act(() => result.current.mutations.splitAtSelection(0));

    expect(result.current.segments).toHaveLength(2);
    expect(result.current.segments[0].end_sec).toBe(1);
    expect(result.current.segments[1].start_sec).toBe(1);
    expect(result.current.selectedIdx).toBe(1);
  });

  it("splitAtPlayhead divides at given time", () => {
    const { result } = renderHook(() =>
      useTestController([makeSeg({ text: "hello", start_sec: 0, end_sec: 3 })])
    );

    act(() => result.current.mutations.splitAtPlayhead(1.5));

    expect(result.current.segments).toHaveLength(2);
    expect(result.current.segments[0].end_sec).toBe(1.5);
    expect(result.current.segments[1].start_sec).toBe(1.5);
  });

  it("mergeSegmentRange folds contiguous segments", () => {
    const { result } = renderHook(() =>
      useTestController([
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
      useTestController([
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

  it("insertSegmentAfter invokes onSelectionCollapsed", () => {
    const onSelectionCollapsed = vi.fn();
    const { result } = renderHook(() =>
      useTestController(
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
      useTestController([makeSeg({ text: "hello world", start_sec: 0, end_sec: 2 })], false, onSelectionCollapsed),
    );

    act(() => result.current.mutations.splitAtSelection(0));

    expect(onSelectionCollapsed).toHaveBeenCalledWith(1);
  });
});
