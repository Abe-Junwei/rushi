// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import type { SegmentDto } from "../tauri/projectApi";
import {
  computeFilteredSegmentIndices,
  DEFAULT_SEGMENT_LIST_FILTER,
  deriveSegmentListFilterProjection,
  formatSegmentListFilterTriggerLabel,
  isDefaultSegmentListFilter,
  resetSegmentListFilter,
  resolveTranscriptFilterVisibleSet,
  segmentMatchesListFilterInput,
  segmentMetaToListFilterMatchInput,
  toggleSegmentStageFilter,
  parseStoredSegmentListFilter,
  readStoredSegmentListFilter,
  writeStoredSegmentListFilter,
} from "./segmentListFilter";

function installMockLocalStorage() {
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, String(value));
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
    clear: () => data.clear(),
  };
  Object.defineProperty(window, "localStorage", { configurable: true, value: storage });
}

function seg(partial: Partial<SegmentDto> & Pick<SegmentDto, "idx">): SegmentDto {
  return {
    idx: partial.idx,
    start_sec: partial.start_sec ?? 0,
    end_sec: partial.end_sec ?? 1,
    text: partial.text ?? "hello",
    low_confidence: partial.low_confidence ?? false,
    text_stage: partial.text_stage ?? "auto_transcribe",
    annotation: partial.annotation ?? null,
    frozen: partial.frozen ?? false,
  };
}

describe("segmentListFilter", () => {
  beforeEach(() => {
    installMockLocalStorage();
    localStorage.clear();
  });

  it("defaults pass all segments", () => {
    const segments = [
      seg({ idx: 0, text_stage: "finalized", annotation: "note", frozen: true }),
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

  it("filters by frozen state", () => {
    const segments = [
      seg({ idx: 0, frozen: true }),
      seg({ idx: 1, frozen: false }),
      seg({ idx: 2 }),
    ];
    expect(
      computeFilteredSegmentIndices(segments, { ...DEFAULT_SEGMENT_LIST_FILTER, frozen: "frozen" }),
    ).toEqual([0]);
    expect(
      computeFilteredSegmentIndices(segments, { ...DEFAULT_SEGMENT_LIST_FILTER, frozen: "unfrozen" }),
    ).toEqual([1, 2]);
  });

  it("reset restores defaults", () => {
    const dirty = {
      ...DEFAULT_SEGMENT_LIST_FILTER,
      annotation: "with" as const,
      frozen: "frozen" as const,
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
      frozen: "frozen" as const,
    };
    expect(formatSegmentListFilterTriggerLabel(partial)).toBe(
      "筛选 · 阶段 4/5 · 有备注 · 已冻结",
    );
    expect(
      formatSegmentListFilterTriggerLabel(DEFAULT_SEGMENT_LIST_FILTER, {
        filteredCount: 12,
        totalCount: 40,
      }),
    ).toBe("筛选 · 12/40");
  });

  it("persists and restores non-default filter", () => {
    const filter = {
      ...DEFAULT_SEGMENT_LIST_FILTER,
      stages: toggleSegmentStageFilter(DEFAULT_SEGMENT_LIST_FILTER.stages, "finalized"),
      annotation: "with" as const,
      frozen: "unfrozen" as const,
    };
    writeStoredSegmentListFilter(filter);
    expect(readStoredSegmentListFilter()).toEqual(filter);
    expect(parseStoredSegmentListFilter(JSON.stringify(filter))).toEqual(filter);
  });

  it("upgrades legacy persisted filters missing frozen to all", () => {
    const legacy = {
      stages: DEFAULT_SEGMENT_LIST_FILTER.stages,
      annotation: "with",
    };
    expect(parseStoredSegmentListFilter(JSON.stringify(legacy))).toEqual({
      stages: DEFAULT_SEGMENT_LIST_FILTER.stages,
      annotation: "with",
      frozen: "all",
    });
  });

  it("upgrades legacy stage maps missing first_proof to enabled", () => {
    const legacy = {
      stages: {
        auto_transcribe: true,
        ai_revised: false,
        manual_transcribe: true,
        finalized: true,
      },
      annotation: "all",
      frozen: "all",
    };
    expect(parseStoredSegmentListFilter(JSON.stringify(legacy))).toEqual({
      stages: {
        auto_transcribe: true,
        ai_revised: false,
        manual_transcribe: true,
        first_proof: true,
        finalized: true,
      },
      annotation: "all",
      frozen: "all",
    });
  });

  it("matches CM meta projection the same as DTO fields", () => {
    const filter = { ...DEFAULT_SEGMENT_LIST_FILTER, annotation: "with" as const, frozen: "frozen" as const };
    expect(
      segmentMatchesListFilterInput(
        segmentMetaToListFilterMatchInput({
          stage: "finalized",
          frozen: true,
          hasAnnotation: true,
        }),
        filter,
      ),
    ).toBe(true);
    expect(
      segmentMatchesListFilterInput(
        segmentMetaToListFilterMatchInput({
          stage: "finalized",
          frozen: true,
          hasAnnotation: false,
        }),
        filter,
      ),
    ).toBe(false);
  });

  it("derives visibleIndexSet / displayPosition / isTrueSubset", () => {
    const derived = deriveSegmentListFilterProjection([1, 3], 5, true);
    expect(derived.isTrueSubset).toBe(true);
    expect(derived.visibleIndexSet?.has(1)).toBe(true);
    expect(derived.displayPositionByIndex?.get(3)).toBe(1);
    expect(resolveTranscriptFilterVisibleSet(true, [0, 1, 2, 3, 4], 5)).toBeNull();
    expect(resolveTranscriptFilterVisibleSet(true, [], 5)?.size).toBe(0);
    expect(deriveSegmentListFilterProjection([0, 1], 2, false).visibleIndexSet).toBeNull();
  });
});
