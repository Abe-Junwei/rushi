import { describe, expect, it } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { segmentDraftKey, segmentDraftStore } from "../hooks/useSegmentDraftStore";
import { makeSeg, useTestSegmentMutationController } from "./useSegmentMutationController.testHelpers";

describe("useSegmentMutationController core", () => {
  it("undo and redo are ignored while busy", () => {
    const { result } = renderHook(() =>
      useTestSegmentMutationController([makeSeg({ text: "b", start_sec: 0, end_sec: 1 })], true),
    );

    act(() => result.current.mutations.undo());

    expect(result.current.segments[0].text).toBe("b");
  });

  it("updateSegmentText is ignored while busy (restore must not be overwritten by blur)", () => {
    const { result } = renderHook(() =>
      useTestSegmentMutationController([makeSeg({ text: "restored", start_sec: 0, end_sec: 1 })], true),
    );

    act(() => result.current.mutations.updateSegmentText(0, "stale"));

    expect(result.current.segments[0].text).toBe("restored");
  });

  it("updateSegmentText changes text and preserves other fields", () => {
    const { result } = renderHook(() =>
      useTestSegmentMutationController([makeSeg({ text: "hello", start_sec: 0, end_sec: 1 })]),
    );

    act(() => result.current.mutations.updateSegmentText(0, "world"));

    expect(result.current.segments[0].text).toBe("world");
    expect(result.current.segments[0].start_sec).toBe(0);
    expect(result.current.segments[0].end_sec).toBe(1);
  });

  it("updateSegmentTime mutates the specified field", () => {
    const { result } = renderHook(() =>
      useTestSegmentMutationController([makeSeg({ text: "a", start_sec: 0, end_sec: 1 })]),
    );

    act(() => result.current.mutations.updateSegmentTime(0, "start_sec", 0.5));

    expect(result.current.segments[0].start_sec).toBe(0.5);
    expect(result.current.segments[0].end_sec).toBe(1);
  });

  it("undo flushes draft then restores committed text", () => {
    const seg = makeSeg({ text: "hello", start_sec: 0, end_sec: 1, uid: "u1" });
    const { result } = renderHook(() => useTestSegmentMutationController([seg]));
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
      useTestSegmentMutationController([makeSeg({ text: "hello", start_sec: 0, end_sec: 1 })]),
    );

    act(() => result.current.mutations.updateSegmentText(0, "world"));
    expect(result.current.segments[0].text).toBe("world");

    act(() => result.current.mutations.undo());
    expect(result.current.segments[0].text).toBe("hello");
  });

  it("redo re-applies undone mutation", () => {
    const { result } = renderHook(() =>
      useTestSegmentMutationController([makeSeg({ text: "hello", start_sec: 0, end_sec: 1 })]),
    );

    act(() => result.current.mutations.updateSegmentText(0, "world"));
    act(() => result.current.mutations.undo());
    act(() => result.current.mutations.redo());

    expect(result.current.segments[0].text).toBe("world");
  });

  it("resetMutationHistory clears undo/redo stacks", () => {
    const { result } = renderHook(() =>
      useTestSegmentMutationController([makeSeg({ text: "hello", start_sec: 0, end_sec: 1 })]),
    );

    act(() => result.current.mutations.updateSegmentText(0, "world"));
    act(() => result.current.mutations.resetMutationHistory());
    act(() => result.current.mutations.undo());

    expect(result.current.segments[0].text).toBe("world");
  });

  it("splitAtSelection divides segment at midpoint", () => {
    const { result } = renderHook(() =>
      useTestSegmentMutationController([makeSeg({ text: "hello world", start_sec: 0, end_sec: 2 })]),
    );

    act(() => result.current.mutations.splitAtSelection(0));

    expect(result.current.segments).toHaveLength(2);
    expect(result.current.segments[0].end_sec).toBe(1);
    expect(result.current.segments[1].start_sec).toBe(1);
    expect(result.current.selectedIdx).toBe(1);
  });

  it("splitAtPlayhead divides at given time", () => {
    const { result } = renderHook(() =>
      useTestSegmentMutationController([makeSeg({ text: "hello", start_sec: 0, end_sec: 3 })]),
    );

    act(() => result.current.mutations.splitAtPlayhead(1.5));

    expect(result.current.segments).toHaveLength(2);
    expect(result.current.segments[0].end_sec).toBe(1.5);
    expect(result.current.segments[1].start_sec).toBe(1.5);
  });
});
