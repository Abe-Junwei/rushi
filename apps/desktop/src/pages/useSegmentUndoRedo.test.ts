import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useRef, useState } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import { useSegmentUndoRedo } from "./useSegmentUndoRedo";

function seg(text: string): SegmentDto {
  return {
    idx: 0,
    uid: "uid-a",
    start_sec: 0,
    end_sec: 1,
    text,
    confidence: null,
    low_confidence: false,
    detail: null,
  };
}

describe("useSegmentUndoRedo", () => {
  it("undo/redo sync segmentsRef with React state", () => {
    const { result } = renderHook(() => {
      const [segments, setSegments] = useState<SegmentDto[]>([seg("hello")]);
      const segmentsRef = useRef(segments);
      segmentsRef.current = segments;
      const undoRedo = useSegmentUndoRedo(segmentsRef, setSegments, () => segmentsRef.current);
      return { segmentsRef, setSegments, undoRedo, segments };
    });

    act(() => result.current.undoRedo.pushUndo());

    act(() => {
      const next = [seg("world")];
      result.current.segmentsRef.current = next;
      result.current.setSegments(next);
    });

    act(() => result.current.undoRedo.undo());

    expect(result.current.segments).toEqual([seg("hello")]);
    expect(result.current.segmentsRef.current).toEqual([seg("hello")]);

    act(() => result.current.undoRedo.redo());

    expect(result.current.segments).toEqual([seg("world")]);
    expect(result.current.segmentsRef.current).toEqual([seg("world")]);
  });
});
