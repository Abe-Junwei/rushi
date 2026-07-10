import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { SegmentDto } from "../tauri/projectApi";
import {
  resetTranscriptFooterStatsForTests,
  useTranscriptFooterStats,
} from "./useTranscriptFooterStats";

describe("useTranscriptFooterStats", () => {
  it("counts segments and characters from SegmentDto[]", () => {
    const segments: SegmentDto[] = [{ uid: "s1", idx: 0, start_sec: 0, end_sec: 1, text: "ab" }];
    const { result, rerender } = renderHook(
      ({ segs }: { segs: SegmentDto[] }) => useTranscriptFooterStats(segs),
      { initialProps: { segs: segments } },
    );

    expect(result.current).toEqual({ segmentCount: 1, charCount: 2 });

    act(() => {
      rerender({ segs: [{ ...segments[0], text: "xyz" }] });
    });

    expect(result.current).toEqual({ segmentCount: 1, charCount: 3 });
  });

  it("resetTranscriptFooterStatsForTests is a no-op after P9b2b", () => {
    resetTranscriptFooterStatsForTests();
  });
});
