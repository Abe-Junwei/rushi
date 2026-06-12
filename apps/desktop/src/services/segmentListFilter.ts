import type { SegmentDto } from "../tauri/projectApi";
import {
  normalizeSegmentTextStage,
  type SegmentTextStage,
} from "./segmentTextStage";
import { segmentHasAnnotation } from "../utils/segmentAnnotation";

export type SegmentAnnotationFilter = "all" | "with" | "without";

export type SegmentStageFilterMap = Record<SegmentTextStage, boolean>;

export type SegmentListFilterState = {
  stages: SegmentStageFilterMap;
  annotation: SegmentAnnotationFilter;
};

export const SEGMENT_TEXT_STAGES: readonly SegmentTextStage[] = [
  "auto_transcribe",
  "ai_revised",
  "manual_transcribe",
  "finalized",
] as const;

export const DEFAULT_SEGMENT_STAGE_FILTER: SegmentStageFilterMap = {
  auto_transcribe: true,
  ai_revised: true,
  manual_transcribe: true,
  finalized: true,
};

export const DEFAULT_SEGMENT_LIST_FILTER: SegmentListFilterState = {
  stages: DEFAULT_SEGMENT_STAGE_FILTER,
  annotation: "all",
};

export function isDefaultSegmentListFilter(filter: SegmentListFilterState): boolean {
  return (
    filter.annotation === "all" &&
    SEGMENT_TEXT_STAGES.every((stage) => filter.stages[stage])
  );
}

export function segmentMatchesListFilter(
  seg: SegmentDto,
  filter: SegmentListFilterState,
): boolean {
  const stage = normalizeSegmentTextStage(seg.text_stage);
  if (!filter.stages[stage]) return false;

  if (filter.annotation === "with" && !segmentHasAnnotation(seg)) return false;
  if (filter.annotation === "without" && segmentHasAnnotation(seg)) return false;

  return true;
}

export function computeFilteredSegmentIndices(
  segments: SegmentDto[],
  filter: SegmentListFilterState,
): number[] {
  const indices: number[] = [];
  for (let i = 0; i < segments.length; i += 1) {
    if (segmentMatchesListFilter(segments[i], filter)) indices.push(i);
  }
  return indices;
}

export function toggleSegmentStageFilter(
  stages: SegmentStageFilterMap,
  stage: SegmentTextStage,
): SegmentStageFilterMap {
  return { ...stages, [stage]: !stages[stage] };
}

export function resetSegmentListFilter(): SegmentListFilterState {
  return {
    stages: { ...DEFAULT_SEGMENT_STAGE_FILTER },
    annotation: "all",
  };
}

const ANNOTATION_FILTER_LABELS: Record<SegmentAnnotationFilter, string> = {
  all: "全部",
  with: "有备注",
  without: "无备注",
};

/** 筛选下拉触发器文案（默认「筛选」；有筛选时摘要 + 可选 n/m）。 */
export function formatSegmentListFilterTriggerLabel(
  filter: SegmentListFilterState,
  opts?: { filteredCount?: number; totalCount?: number },
): string {
  const parts: string[] = [];
  if (!isDefaultSegmentListFilter(filter)) {
    const enabledCount = SEGMENT_TEXT_STAGES.filter((stage) => filter.stages[stage]).length;
    if (enabledCount < SEGMENT_TEXT_STAGES.length) {
      parts.push(`阶段 ${enabledCount}/${SEGMENT_TEXT_STAGES.length}`);
    }
    if (filter.annotation !== "all") {
      parts.push(ANNOTATION_FILTER_LABELS[filter.annotation]);
    }
  }
  const filteredCount = opts?.filteredCount;
  const totalCount = opts?.totalCount;
  if (
    filteredCount != null &&
    totalCount != null &&
    totalCount > 0 &&
    filteredCount < totalCount
  ) {
    parts.push(`${filteredCount}/${totalCount}`);
  }
  if (parts.length === 0) return "筛选";
  return `筛选 · ${parts.join(" · ")}`;
}

export function segmentListFilterAnnotationLabel(value: SegmentAnnotationFilter): string {
  return ANNOTATION_FILTER_LABELS[value];
}
