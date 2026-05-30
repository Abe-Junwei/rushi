import { describe, expect, it } from "vitest";
import type { SegmentDto } from "../tauri/projectApi";
import {
  parseDominantSpanFilteredCount,
  sanitizeSegmentsForMedia,
} from "./segmentMediaSanitize";

function seg(start_sec: number, end_sec: number): SegmentDto {
  return {
    idx: 0,
    start_sec,
    end_sec,
    text: "x",
    confidence: null,
    low_confidence: false,
    detail: null,
    uid: "u1",
  };
}

describe("sanitizeSegmentsForMedia", () => {
  it("clamps segment end to media duration", () => {
    const { segments, removedDominantCount } = sanitizeSegmentsForMedia([seg(0, 999)], 120);
    expect(removedDominantCount).toBe(0);
    expect(segments[0]?.end_sec).toBe(120);
  });

  it("removes dominant spans when normal segments exist", () => {
    const { segments, removedDominantCount } = sanitizeSegmentsForMedia(
      [seg(30, 1000), seg(40, 50), seg(100, 1000)],
      1000,
    );
    expect(removedDominantCount).toBe(2);
    expect(segments).toHaveLength(1);
    expect(segments[0]?.start_sec).toBe(40);
  });

  it("keeps a single whole-track segment", () => {
    const { segments, removedDominantCount } = sanitizeSegmentsForMedia([seg(0, 20)], 20);
    expect(removedDominantCount).toBe(0);
    expect(segments).toHaveLength(1);
  });

  it("keeps explicit speech span the heuristic would drop", () => {
    const speech: SegmentDto = {
      ...seg(0, 950),
      kind: "speech",
    };
    const { segments, removedDominantCount } = sanitizeSegmentsForMedia(
      [speech, seg(960, 990)],
      1000,
    );
    expect(removedDominantCount).toBe(0);
    expect(segments).toHaveLength(2);
  });
});

describe("parseDominantSpanFilteredCount", () => {
  it("reads filtered count from backend warning", () => {
    expect(parseDominantSpanFilteredCount(["segments_dominant_span_filtered:2"])).toBe(2);
    expect(parseDominantSpanFilteredCount(["other"])).toBe(0);
  });
});
