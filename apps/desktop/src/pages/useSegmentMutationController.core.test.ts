import { describe, expect, it } from "vitest";
import { renderHook, act } from "@testing-library/react";
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
      useTestSegmentMutationController([
        makeSeg({ text: "hello", start_sec: 0, end_sec: 1, text_stage: "auto_transcribe" }),
      ]),
    );

    act(() => result.current.mutations.updateSegmentText(0, "world"));

    expect(result.current.segments[0].text).toBe("world");
    expect(result.current.segments[0].start_sec).toBe(0);
    expect(result.current.segments[0].end_sec).toBe(1);
    expect(result.current.segments[0].text_stage).toBe("manual_transcribe");
    expect(result.current.segments[0].finalize_via).toBeNull();
  });

  it("updateSegmentTime mutates the specified field", () => {
    const { result } = renderHook(() =>
      useTestSegmentMutationController([makeSeg({ text: "a", start_sec: 0, end_sec: 1 })]),
    );

    act(() => result.current.mutations.updateSegmentTime(0, "start_sec", 0.5));

    expect(result.current.segments[0].start_sec).toBe(0.5);
    expect(result.current.segments[0].end_sec).toBe(1);
    expect(result.current.segmentsRef.current[0]?.start_sec).toBe(0.5);
  });

  it("undo restores committed text after updateSegmentText", () => {
    const seg = makeSeg({ text: "hello", start_sec: 0, end_sec: 1, uid: "u1" });
    const { result } = renderHook(() => useTestSegmentMutationController([seg]));

    act(() => result.current.mutations.updateSegmentText(0, "world"));
    act(() => result.current.mutations.undo());

    expect(result.current.segments[0].text).toBe("hello");
  });

  it("redo works after undo when segmentsRef was ahead of React state", () => {
    const { result } = renderHook(() =>
      useTestSegmentMutationController([makeSeg({ text: "hello", start_sec: 0, end_sec: 1 })]),
    );

    act(() => result.current.mutations.updateSegmentText(0, "world"));
    act(() => result.current.mutations.undo());
    act(() => result.current.mutations.redo());

    expect(result.current.segments[0]?.text).toBe("world");
    expect(result.current.mutations).toBeDefined();
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
    expect(result.current.segments[0].text).toBe("hello ");
    expect(result.current.segments[1].text).toBe("world");
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

  it("splitAtSelection keeps committed text on both halves", () => {
    const seg = makeSeg({ text: "abcdef", start_sec: 0, end_sec: 10, uid: "uid-split" });
    const { result } = renderHook(() => useTestSegmentMutationController([seg]));

    act(() => result.current.mutations.updateSegmentText(0, "abcdef"));
    act(() => result.current.mutations.splitAtSelection(0));

    expect(result.current.segments[0]?.text).toBe("abc");
    expect(result.current.segments[1]?.text).toBe("def");
  });

  it("mergeWithNextAt includes live segment text", () => {
    const { result } = renderHook(() =>
      useTestSegmentMutationController([
        makeSeg({ text: "hello", start_sec: 0, end_sec: 1, uid: "uid-a" }),
        makeSeg({ text: "world", start_sec: 1, end_sec: 2, uid: "uid-b" }),
      ]),
    );

    act(() => result.current.mutations.updateSegmentText(0, "edited head"));
    act(() => result.current.mutations.mergeWithNextAt(0));

    expect(result.current.segments).toHaveLength(1);
    expect(result.current.segments[0]?.text).toBe("edited head world");
  });

  it("mergeWithNextAt uses segmentsRef when React state lags behind ref", () => {
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
    expect(result.current.segments[0]?.text).toBe("edited head world");
  });

  it("updateSegmentText round-trip within same tick keeps segments in sync", () => {
    const { result } = renderHook(() =>
      useTestSegmentMutationController([makeSeg({ text: "hello", start_sec: 0, end_sec: 1 })]),
    );

    act(() => {
      result.current.mutations.updateSegmentText(0, "hellox");
      result.current.mutations.updateSegmentText(0, "hello");
    });

    expect(result.current.segments[0]?.text).toBe("hello");
  });
});
