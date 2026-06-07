import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { SegmentDto } from "../tauri/projectApi";
import { segmentDraftKey, segmentDraftStore } from "./useSegmentDraftStore";
import { useTranscriptFooterStats } from "./useTranscriptFooterStats";

describe("useTranscriptFooterStats", () => {
  it("updates char count when draft changes without flushing segments", () => {
    segmentDraftStore.resetAll();
    const segments: SegmentDto[] = [{ uid: "s1", idx: 0, start_sec: 0, end_sec: 1, text: "ab" }];
    const { result } = renderHook(() => useTranscriptFooterStats(segments));

    expect(result.current).toEqual({ segmentCount: 1, charCount: 2 });

    act(() => {
      segmentDraftStore.setDraft(segmentDraftKey(segments[0], 0), "a");
    });

    expect(result.current).toEqual({ segmentCount: 1, charCount: 1 });
  });
});
