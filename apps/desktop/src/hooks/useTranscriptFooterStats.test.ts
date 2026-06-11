import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SegmentDto } from "../tauri/projectApi";
import {
  segmentDraftKey,
  segmentDraftStore,
  subscribeSegmentDraftStore,
} from "./useSegmentDraftStore";
import {
  resetTranscriptFooterStatsForTests,
  TRANSCRIPT_FOOTER_STATS_THROTTLE_MS,
  useTranscriptFooterStats,
} from "./useTranscriptFooterStats";

describe("useTranscriptFooterStats", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetTranscriptFooterStatsForTests();
    segmentDraftStore.resetAll();
  });

  afterEach(() => {
    resetTranscriptFooterStatsForTests();
    vi.useRealTimers();
    segmentDraftStore.resetAll();
  });

  it("updates char count when draft changes without flushing segments", () => {
    const segments: SegmentDto[] = [{ uid: "s1", idx: 0, start_sec: 0, end_sec: 1, text: "ab" }];
    const { result } = renderHook(() => useTranscriptFooterStats(segments));

    expect(result.current).toEqual({ segmentCount: 1, charCount: 2 });

    act(() => {
      segmentDraftStore.setDraft(segmentDraftKey(segments[0], 0), "a");
      segmentDraftStore.flushPendingEmit();
      vi.advanceTimersByTime(TRANSCRIPT_FOOTER_STATS_THROTTLE_MS);
    });

    expect(result.current).toEqual({ segmentCount: 1, charCount: 1 });
  });

  it("coalesces rapid draft updates within throttle window", () => {
    const segments: SegmentDto[] = [{ uid: "s1", idx: 0, start_sec: 0, end_sec: 1, text: "ab" }];
    const { result } = renderHook(() => useTranscriptFooterStats(segments));

    act(() => {
      segmentDraftStore.setDraft(segmentDraftKey(segments[0], 0), "x");
      segmentDraftStore.flushPendingEmit();
      segmentDraftStore.setDraft(segmentDraftKey(segments[0], 0), "xyz");
      segmentDraftStore.flushPendingEmit();
      vi.advanceTimersByTime(TRANSCRIPT_FOOTER_STATS_THROTTLE_MS);
    });

    expect(result.current.charCount).toBe(3);
  });
});

describe("segmentDraftStore emit coalescing", () => {
  it("coalesces multiple setDraft calls into one emit until flushPendingEmit", () => {
    segmentDraftStore.resetAll();
    const listener = vi.fn();
    const off = subscribeSegmentDraftStore(listener);

    segmentDraftStore.setDraft("k", "a");
    segmentDraftStore.setDraft("k", "ab");
    segmentDraftStore.setDraft("k", "abc");
    expect(listener).not.toHaveBeenCalled();

    segmentDraftStore.flushPendingEmit();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(segmentDraftStore.getDraft("k")).toBe("abc");

    off();
    segmentDraftStore.resetAll();
  });

  it("endComposition schedules a single emit", () => {
    segmentDraftStore.resetAll();
    const listener = vi.fn();
    const off = subscribeSegmentDraftStore(listener);

    segmentDraftStore.beginComposition("k");
    expect(listener).not.toHaveBeenCalled();

    segmentDraftStore.endComposition("k");
    expect(listener).not.toHaveBeenCalled();

    segmentDraftStore.flushPendingEmit();
    expect(listener).toHaveBeenCalledTimes(1);

    off();
    segmentDraftStore.resetAll();
  });
});
