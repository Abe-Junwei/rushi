import { describe, expect, it, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCallback, useRef, useState } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import { segmentDraftStore } from "../hooks/useSegmentDraftStore";
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

  const gate = useSegmentDeleteConfirmController({
    segmentsRef,
    flushSegmentTextDrafts: () => {},
    deleteSegmentAt,
  });

  return { ...gate, segments, deleted: deletedRef.current };
}

describe("useSegmentDeleteConfirmController", () => {
  beforeEach(() => {
    segmentDraftStore.resetAll();
  });
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
});
