import { describe, expect, it, beforeEach } from "vitest";
import {
  isTranscribeAsyncUnavailable,
  isTranscribeUserCancellation,
  mergeTranscribeSegmentsDelta,
  parseTranscribeProgress,
  resetPreviewUidCounterForTests,
  snapshotSegmentsForRestore,
  TranscribeUserCancelledError,
} from "./transcribePreviewState";
import type { SegmentDto } from "../tauri/projectApi";

function seg(text: string, idx: number): SegmentDto {
  return {
    uid: `u${idx}`,
    idx,
    start_sec: idx,
    end_sec: idx + 1,
    text,
    confidence: null,
    low_confidence: false,
    detail: null,
    kind: "speech",
  };
}

describe("transcribePreviewState", () => {
  beforeEach(() => {
    resetPreviewUidCounterForTests();
  });

  it("snapshotSegmentsForRestore clones rows", () => {
    const src = [seg("a", 0)];
    const snap = snapshotSegmentsForRestore(src);
    snap[0].text = "mutated";
    expect(src[0].text).toBe("a");
  });

  it("mergeTranscribeSegmentsDelta appends with idx", () => {
    const merged = mergeTranscribeSegmentsDelta([seg("a", 0)], [
      { start_sec: 10, end_sec: 11, text: "b", kind: "speech" },
      { start_sec: 12, end_sec: 13, text: "c", kind: "speech" },
    ]);
    expect(merged).toHaveLength(3);
    expect(merged[1].text).toBe("b");
    expect(merged[1].idx).toBe(1);
    expect(merged[2].idx).toBe(2);
  });

  it("parseTranscribeProgress reads window fields", () => {
    expect(
      parseTranscribeProgress({ phase: "transcribing", window_index: 2, window_count: 5, segments_total: 12 }),
    ).toEqual({ windowIndex: 2, windowCount: 5, segmentsTotal: 12 });
  });

  it("isTranscribeAsyncUnavailable matches stale sidecar 404", () => {
    expect(
      isTranscribeAsyncUnavailable(
        new Error('ASR HTTP 404 Not Found: {"detail":"Not Found"}'),
      ),
    ).toBe(true);
    expect(isTranscribeAsyncUnavailable(new Error("ASR HTTP 500 Internal Server Error"))).toBe(false);
  });

  it("isTranscribeUserCancellation detects cancel error", () => {
    expect(isTranscribeUserCancellation(new TranscribeUserCancelledError())).toBe(true);
    expect(isTranscribeUserCancellation(new Error("转写已取消"))).toBe(false);
  });
});
