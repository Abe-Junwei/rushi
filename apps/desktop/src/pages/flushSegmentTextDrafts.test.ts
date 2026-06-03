import { renderHook, act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useRef, useState } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import { flushSegmentTextDrafts } from "./flushSegmentTextDrafts";
import { segmentDraftKey, segmentDraftStore } from "../hooks/useSegmentDraftStore";
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

describe("flushSegmentTextDrafts undo", () => {
  it("draft-only flush then undo restores text before auto-save", () => {
    segmentDraftStore.resetAll();
    const initial = seg("before blur");

    const { result } = renderHook(() => {
      const segmentsRef = useRef<SegmentDto[]>([initial]);
      const [segments, setSegments] = useState<SegmentDto[]>([initial]);
      segmentsRef.current = segments;
      const undoRedo = useSegmentUndoRedo(segmentsRef, setSegments);
      return { segmentsRef, setSegments, undoRedo, segments };
    });

    const key = segmentDraftKey(initial, 0);
    segmentDraftStore.setDraft(key, "typed without blur");

    act(() => {
      flushSegmentTextDrafts(result.current.segmentsRef, result.current.setSegments, {
        beforeApplyUpdates: (updates) => {
          for (const { idx } of updates) {
            result.current.undoRedo.pushUndoForTextEdit(idx);
          }
        },
      });
    });

    expect(result.current.segments[0]?.text).toBe("typed without blur");

    act(() => {
      result.current.undoRedo.undo();
    });

    expect(result.current.segments[0]?.text).toBe("before blur");
  });
});
