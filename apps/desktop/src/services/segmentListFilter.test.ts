import { describe, expect, it } from "vitest";
import type { SegmentDto } from "../tauri/projectApi";
import {
  computeFilteredSegmentIndices,
  DEFAULT_SEGMENT_LIST_FILTER,
  formatSegmentListFilterTriggerLabel,
  isDefaultSegmentListFilter,
  resetSegmentListFilter,
  toggleSegmentStageFilter,
} from "./segmentListFilter";

function seg(partial: Partial<SegmentDto> & Pick<SegmentDto, "idx">): SegmentDto {
  return {
    idx: partial.idx,
    start_sec: partial.start_sec ?? 0,
    end_sec: partial.end_sec ?? 1,
    text: partial.text ?? "hello",
    low_confidence: partial.low_confidence ?? false,
    text_stage: partial.text_stage ?? "auto_transcribe",
    annotation: partial.annotation ?? null,
  };
}

describe("segmentListFilter", () => {
  it("defaults pass all segments", () => {
    const segments = [
      seg({ idx: 0, text_stage: "finalized", annotation: "note" }),
      seg({ idx: 1, low_confidence: true }),
    ];
    expect(isDefaultSegmentListFilter(DEFAULT_SEGMENT_LIST_FILTER)).toBe(true);
    expect(computeFilteredSegmentIndices(segments, DEFAULT_SEGMENT_LIST_FILTER)).toEqual([0, 1]);
  });

  it("filters by text_stage", () => {
    const segments = [
      seg({ idx: 0, text_stage: "auto_transcribe" }),
      seg({ idx: 1, text_stage: "finalized" }),
    ];
    const filter = {
      ...DEFAULT_SEGMENT_LIST_FILTER,
      stages: toggleSegmentStageFilter(DEFAULT_SEGMENT_LIST_FILTER.stages, "auto_transcribe"),
    };
    expect(computeFilteredSegmentIndices(segments, filter)).toEqual([1]);
  });

  it("filters by annotation presence", () => {
    const segments = [
      seg({ idx: 0, annotation: "  note  " }),
      seg({ idx: 1, annotation: null }),
      seg({ idx: 2, annotation: "   " }),
    ];
    const withOnly = { ...DEFAULT_SEGMENT_LIST_FILTER, annotation: "with" as const };
    const withoutOnly = { ...DEFAULT_SEGMENT_LIST_FILTER, annotation: "without" as const };
    expect(computeFilteredSegmentIndices(segments, withOnly)).toEqual([0]);
    expect(computeFilteredSegmentIndices(segments, withoutOnly)).toEqual([1, 2]);
  });

  it("reset restores defaults", () => {
    const dirty = {
      ...DEFAULT_SEGMENT_LIST_FILTER,
      annotation: "with" as const,
      stages: toggleSegmentStageFilter(DEFAULT_SEGMENT_LIST_FILTER.stages, "finalized"),
    };
    expect(isDefaultSegmentListFilter(resetSegmentListFilter())).toBe(true);
    expect(isDefaultSegmentListFilter(dirty)).toBe(false);
  });

  it("formats trigger label summary", () => {
    expect(formatSegmentListFilterTriggerLabel(DEFAULT_SEGMENT_LIST_FILTER)).toBe("筛选");
    const partial = {
      ...DEFAULT_SEGMENT_LIST_FILTER,
      stages: toggleSegmentStageFilter(DEFAULT_SEGMENT_LIST_FILTER.stages, "finalized"),
      annotation: "with" as const,
    };
    expect(formatSegmentListFilterTriggerLabel(partial)).toBe("筛选 · 阶段 3/4 · 有备注");
    expect(
      formatSegmentListFilterTriggerLabel(DEFAULT_SEGMENT_LIST_FILTER, {
        filteredCount: 12,
        totalCount: 40,
      }),
    ).toBe("筛选 · 12/40");
  });
});
