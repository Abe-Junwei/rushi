import { describe, expect, it } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCallback, useRef, useState } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import { useSegmentDeleteConfirmController } from "./useSegmentDeleteConfirmController";

function makeSeg(text: string): SegmentDto {
  return {
    uid: "u1",
    idx: 0,
    start_sec: 0,
    end_sec: 1,
    text,
    confidence: null,
    low_confidence: false,
  };
}

function useTestDeleteConfirm(initial: SegmentDto[]) {
  const [segments, setSegments] = useState(initial);
  const segmentsRef = useRef(segments);
  segmentsRef.current = segments;
  const deletedRef = useRef<number[]>([]);

  const deleteSegmentAt = useCallback((idx: number) => {
    deletedRef.current.push(idx);
    setSegments((prev) => prev.filter((_, j) => j !== idx));
  }, []);

  const deleteSegmentRange = useCallback((lo: number, hi: number) => {
    for (let i = lo; i <= hi; i += 1) deletedRef.current.push(i);
    setSegments((prev) => prev.filter((_, j) => j < lo || j > hi));
  }, []);

  const deleteSegmentIndices = useCallback((indices: number[]) => {
    const remove = new Set(indices);
    for (const idx of indices) deletedRef.current.push(idx);
    setSegments((prev) => prev.filter((_, j) => !remove.has(j)));
  }, []);

  const gate = useSegmentDeleteConfirmController({
    getCurrentSegmentsSnapshot: () => segmentsRef.current,
    flushSegmentTextDrafts: () => {},
    deleteSegmentAt,
    deleteSegmentRange,
    deleteSegmentIndices,
  });

  return { ...gate, segments, deleted: deletedRef.current };
}

describe("useSegmentDeleteConfirmController", () => {
  it("deletes empty segments immediately", () => {
    const { result } = renderHook(() => useTestDeleteConfirm([makeSeg("")]));

    act(() => result.current.requestDeleteSegmentAt(0));

    expect(result.current.segmentDeleteConfirmOpen).toBe(false);
    expect(result.current.deleted).toEqual([0]);
    expect(result.current.segments).toHaveLength(0);
  });

  it("opens confirm dialog for segments with text", () => {
    const { result } = renderHook(() => useTestDeleteConfirm([makeSeg("正文")]));

    act(() => result.current.requestDeleteSegmentAt(0));

    expect(result.current.segmentDeleteConfirmOpen).toBe(true);
    expect(result.current.deleted).toEqual([]);
  });

  it("deletes after confirm", () => {
    const { result } = renderHook(() => useTestDeleteConfirm([makeSeg("正文")]));

    act(() => result.current.requestDeleteSegmentAt(0));
    act(() => result.current.confirmDeleteSegment());

    expect(result.current.segmentDeleteConfirmOpen).toBe(false);
    expect(result.current.deleted).toEqual([0]);
  });

  it("cancels without deleting", () => {
    const { result } = renderHook(() => useTestDeleteConfirm([makeSeg("正文")]));

    act(() => result.current.requestDeleteSegmentAt(0));
    act(() => result.current.cancelDeleteSegment());

    expect(result.current.segmentDeleteConfirmOpen).toBe(false);
    expect(result.current.deleted).toEqual([]);
    expect(result.current.segments).toHaveLength(1);
  });

  it("requestDeleteSelection opens confirm for range with text", () => {
    const { result } = renderHook(() =>
      useTestDeleteConfirm([makeSeg("a"), makeSeg("b"), makeSeg("c")]),
    );

    act(() => result.current.requestDeleteSelection(0, 2));

    expect(result.current.segmentDeleteConfirmOpen).toBe(true);
    expect(result.current.pendingDeleteCount).toBe(3);
    expect(result.current.deleted).toEqual([]);
  });

  it("requestDeleteSelection deletes empty range immediately", () => {
    const { result } = renderHook(() =>
      useTestDeleteConfirm([makeSeg(""), makeSeg(""), makeSeg("")]),
    );

    act(() => result.current.requestDeleteSelection(0, 1));

    expect(result.current.segmentDeleteConfirmOpen).toBe(false);
    expect(result.current.segments).toHaveLength(1);
    expect(result.current.deleted).toEqual([0, 1]);
  });

  it("confirmDeleteSegment deletes pending range", () => {
    const { result } = renderHook(() =>
      useTestDeleteConfirm([makeSeg("a"), makeSeg("b"), makeSeg("c")]),
    );

    act(() => result.current.requestDeleteSelection(0, 1));
    act(() => result.current.confirmDeleteSegment());

    expect(result.current.segmentDeleteConfirmOpen).toBe(false);
    expect(result.current.segments).toHaveLength(1);
    expect(result.current.segments[0].text).toBe("c");
  });

  it("requestDeleteSelectedIndices deletes sparse empty segments immediately", () => {
    const { result } = renderHook(() =>
      useTestDeleteConfirm([
        makeSeg(""),
        makeSeg(""),
        makeSeg(""),
        makeSeg(""),
        makeSeg(""),
      ]),
    );

    act(() => result.current.requestDeleteSelectedIndices([0, 2, 4]));

    expect(result.current.segmentDeleteConfirmOpen).toBe(false);
    expect(result.current.segments).toHaveLength(2);
    expect(result.current.deleted.sort()).toEqual([0, 2, 4]);
  });

  it("requestDeleteSelectedIndices opens confirm when any selected segment has text", () => {
    const { result } = renderHook(() =>
      useTestDeleteConfirm([makeSeg(""), makeSeg("skip"), makeSeg("x"), makeSeg("skip"), makeSeg("")]),
    );

    act(() => result.current.requestDeleteSelectedIndices([0, 2, 4]));

    expect(result.current.segmentDeleteConfirmOpen).toBe(true);
    expect(result.current.pendingDeleteCount).toBe(3);
    expect(result.current.deleted).toEqual([]);
  });
});
