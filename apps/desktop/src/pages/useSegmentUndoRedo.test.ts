import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useRef, useState } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import { useSegmentUndoRedo } from "./useSegmentUndoRedo";
import { createSegmentPublishApi } from "./segmentPublishApi";

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
      const segmentPublish = createSegmentPublishApi(segmentsRef, setSegments);
      const undoRedo = useSegmentUndoRedo(
        segmentPublish.publishTextBulk,
        segmentPublish.getCurrentSegmentsSnapshot,
      );
      return { segmentsRef, setSegments, undoRedo, segments, segmentPublish };
    });

    act(() => result.current.undoRedo.pushUndo());

    act(() => {
      result.current.segmentPublish.publishTextBulk([seg("world")]);
    });

    act(() => result.current.undoRedo.undo());

    expect(result.current.segments).toEqual([seg("hello")]);
    expect(result.current.segmentsRef.current).toEqual([seg("hello")]);

    act(() => result.current.undoRedo.redo());

    expect(result.current.segments).toEqual([seg("world")]);
    expect(result.current.segmentsRef.current).toEqual([seg("world")]);
  });
});
