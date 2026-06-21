import type { SegmentDto } from "../tauri/projectApi";
import {
  normalizeSegmentTextStage,
  type SegmentTextStage,
} from "./segmentTextStage";
import { segmentHasAnnotation } from "../utils/segmentAnnotation";

/** 语段列表视图筛选（仅控制 EditorSegmentList 可见行；不改 selectedIdx / 波形选中）。 */

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

const DEFAULT_SEGMENT_STAGE_FILTER: SegmentStageFilterMap = {
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

function segmentMatchesListFilter(
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

export const SEGMENT_LIST_FILTER_STORAGE_KEY = "rushi.editor.segmentListFilter.v1";

function isSegmentStageFilterMap(value: unknown): value is SegmentStageFilterMap {
  if (!value || typeof value !== "object") return false;
  return SEGMENT_TEXT_STAGES.every(
    (stage) => typeof (value as SegmentStageFilterMap)[stage] === "boolean",
  );
}

export function parseStoredSegmentListFilter(raw: string | null): SegmentListFilterState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SegmentListFilterState>;
    if (!isSegmentStageFilterMap(parsed.stages)) return null;
    const annotation = parsed.annotation;
    if (annotation !== "all" && annotation !== "with" && annotation !== "without") return null;
    return { stages: parsed.stages, annotation };
  } catch {
    return null;
  }
}

export function readStoredSegmentListFilter(): SegmentListFilterState {
  if (typeof window === "undefined") return DEFAULT_SEGMENT_LIST_FILTER;
  try {
    return parseStoredSegmentListFilter(localStorage.getItem(SEGMENT_LIST_FILTER_STORAGE_KEY))
      ?? DEFAULT_SEGMENT_LIST_FILTER;
  } catch {
    return DEFAULT_SEGMENT_LIST_FILTER;
  }
}

export function writeStoredSegmentListFilter(filter: SegmentListFilterState): void {
  if (typeof window === "undefined") return;
  try {
    if (isDefaultSegmentListFilter(filter)) {
      localStorage.removeItem(SEGMENT_LIST_FILTER_STORAGE_KEY);
      return;
    }
    localStorage.setItem(SEGMENT_LIST_FILTER_STORAGE_KEY, JSON.stringify(filter));
  } catch {
    /* noop */
  }
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
