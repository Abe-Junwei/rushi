import type { SegmentDto } from "../tauri/projectApi";
import {
  normalizeSegmentTextStage,
  type SegmentTextStage,
} from "./segmentTextStage";
import { segmentHasAnnotation } from "../utils/segmentAnnotation";
import { isSegmentFrozen } from "../utils/frozenPlaybackSkip";

/** 语段列表视图筛选（仅控制 EditorSegmentList 可见行；不改 selectedIdx / 波形选中）。 */

export type SegmentAnnotationFilter = "all" | "with" | "without";

/** 冻结状态：全部 / 仅冻结 / 仅未冻结。 */
export type SegmentFrozenFilter = "all" | "frozen" | "unfrozen";

export type SegmentStageFilterMap = Record<SegmentTextStage, boolean>;

export type SegmentListFilterState = {
  stages: SegmentStageFilterMap;
  annotation: SegmentAnnotationFilter;
  frozen: SegmentFrozenFilter;
};

export const SEGMENT_TEXT_STAGES: readonly SegmentTextStage[] = [
  "auto_transcribe",
  "ai_revised",
  "manual_transcribe",
  "first_proof",
  "finalized",
] as const;

const DEFAULT_SEGMENT_STAGE_FILTER: SegmentStageFilterMap = {
  auto_transcribe: true,
  ai_revised: true,
  manual_transcribe: true,
  first_proof: true,
  finalized: true,
};

export const DEFAULT_SEGMENT_LIST_FILTER: SegmentListFilterState = {
  stages: DEFAULT_SEGMENT_STAGE_FILTER,
  annotation: "all",
  frozen: "all",
};

export function isDefaultSegmentListFilter(filter: SegmentListFilterState): boolean {
  return (
    filter.annotation === "all" &&
    filter.frozen === "all" &&
    SEGMENT_TEXT_STAGES.every((stage) => filter.stages[stage])
  );
}

/** Minimal fields shared by SegmentDto and CM SegmentMeta for list filtering. */
export type SegmentListFilterMatchInput = {
  stage: SegmentTextStage | null | undefined;
  frozen: boolean;
  hasAnnotation: boolean;
};

export function segmentDtoToListFilterMatchInput(seg: SegmentDto): SegmentListFilterMatchInput {
  return {
    stage: seg.text_stage,
    frozen: isSegmentFrozen(seg),
    hasAnnotation: segmentHasAnnotation(seg),
  };
}

export function segmentMetaToListFilterMatchInput(meta: {
  stage: SegmentTextStage | null | undefined;
  frozen: boolean;
  hasAnnotation: boolean;
}): SegmentListFilterMatchInput {
  return {
    stage: meta.stage,
    frozen: Boolean(meta.frozen),
    hasAnnotation: Boolean(meta.hasAnnotation),
  };
}

/** Pure matcher — consume DTO or CM meta projection without copying full SegmentDto. */
export function segmentMatchesListFilterInput(
  input: SegmentListFilterMatchInput,
  filter: SegmentListFilterState,
): boolean {
  const stage = normalizeSegmentTextStage(input.stage);
  if (!filter.stages[stage]) return false;

  if (filter.annotation === "with" && !input.hasAnnotation) return false;
  if (filter.annotation === "without" && input.hasAnnotation) return false;

  if (filter.frozen === "frozen" && !input.frozen) return false;
  if (filter.frozen === "unfrozen" && input.frozen) return false;

  return true;
}

export function computeFilteredSegmentIndicesFromMatchInputs(
  items: readonly SegmentListFilterMatchInput[],
  filter: SegmentListFilterState,
): number[] {
  const indices: number[] = [];
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    if (item && segmentMatchesListFilterInput(item, filter)) indices.push(i);
  }
  return indices;
}

export function computeFilteredSegmentIndices(
  segments: SegmentDto[],
  filter: SegmentListFilterState,
): number[] {
  const indices: number[] = [];
  for (let i = 0; i < segments.length; i += 1) {
    const seg = segments[i];
    if (seg && segmentMatchesListFilterInput(segmentDtoToListFilterMatchInput(seg), filter)) {
      indices.push(i);
    }
  }
  return indices;
}

/**
 * Derived filter projections shared by list / CM6 / waveform / nav.
 * `visibleIndexSet` is null when filter is inactive (paint/hit all).
 * When active, it is the matching index Set (may be empty).
 */
export type SegmentListFilterDerived = {
  filteredIndices: number[];
  visibleIndexSet: ReadonlySet<number> | null;
  displayPositionByIndex: ReadonlyMap<number, number> | null;
  isTrueSubset: boolean;
};

export function deriveSegmentListFilterProjection(
  filteredIndices: readonly number[],
  segmentCount: number,
  filterActive: boolean,
): Omit<SegmentListFilterDerived, "filteredIndices"> {
  if (!filterActive) {
    return {
      visibleIndexSet: null,
      displayPositionByIndex: null,
      isTrueSubset: false,
    };
  }
  const isTrueSubset =
    segmentCount > 0 && filteredIndices.length < segmentCount;
  const visibleIndexSet = new Set(filteredIndices);
  const displayPositionByIndex = new Map<number, number>();
  for (let i = 0; i < filteredIndices.length; i += 1) {
    const idx = filteredIndices[i];
    if (idx !== undefined) displayPositionByIndex.set(idx, i);
  }
  return { visibleIndexSet, displayPositionByIndex, isTrueSubset };
}

/** CM6 visibility: null = show all; Set (possibly empty) when filter hides any/all. */
export function resolveTranscriptFilterVisibleSet(
  filterActive: boolean,
  filteredIndices: readonly number[],
  segmentCount: number,
): ReadonlySet<number> | null {
  if (!filterActive) return null;
  if (segmentCount > 0 && filteredIndices.length >= segmentCount) return null;
  return new Set(filteredIndices);
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
    frozen: "all",
  };
}

export const SEGMENT_LIST_FILTER_STORAGE_KEY = "rushi.editor.segmentListFilter.v1";

/** Accept legacy maps missing newer stages (fill with default true). */
function coerceSegmentStageFilterMap(value: unknown): SegmentStageFilterMap | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  let known = 0;
  const stages = { ...DEFAULT_SEGMENT_STAGE_FILTER };
  for (const stage of SEGMENT_TEXT_STAGES) {
    if (typeof raw[stage] === "boolean") {
      stages[stage] = raw[stage];
      known += 1;
    }
  }
  return known > 0 ? stages : null;
}

function parseTriState<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

export function parseStoredSegmentListFilter(raw: string | null): SegmentListFilterState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SegmentListFilterState>;
    const stages = coerceSegmentStageFilterMap(parsed.stages);
    if (!stages) return null;
    return {
      stages,
      annotation: parseTriState(parsed.annotation, ["all", "with", "without"] as const, "all"),
      // Older persisted filters omit frozen — default to "all".
      frozen: parseTriState(parsed.frozen, ["all", "frozen", "unfrozen"] as const, "all"),
    };
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

const FROZEN_FILTER_LABELS: Record<SegmentFrozenFilter, string> = {
  all: "全部",
  frozen: "已冻结",
  unfrozen: "未冻结",
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
    if (filter.frozen !== "all") {
      parts.push(FROZEN_FILTER_LABELS[filter.frozen]);
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

export function segmentListFilterFrozenLabel(value: SegmentFrozenFilter): string {
  return FROZEN_FILTER_LABELS[value];
}
