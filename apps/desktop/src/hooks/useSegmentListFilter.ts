import { useCallback, useEffect, useMemo, useState } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import type { SegmentTextStage } from "../services/segmentTextStage";
import {
  computeFilteredSegmentIndices,
  DEFAULT_SEGMENT_LIST_FILTER,
  isDefaultSegmentListFilter,
  resetSegmentListFilter,
  toggleSegmentStageFilter,
  type SegmentAnnotationFilter,
  type SegmentListFilterState,
} from "../services/segmentListFilter";

export function useSegmentListFilter(currentFileId: string | null, segments: SegmentDto[]) {
  const [filter, setFilter] = useState<SegmentListFilterState>(DEFAULT_SEGMENT_LIST_FILTER);

  useEffect(() => {
    setFilter(DEFAULT_SEGMENT_LIST_FILTER);
  }, [currentFileId]);

  const filteredIndices = useMemo(
    () => computeFilteredSegmentIndices(segments, filter),
    [segments, filter],
  );

  const isActive = !isDefaultSegmentListFilter(filter);

  const toggleStage = useCallback((stage: SegmentTextStage) => {
    setFilter((prev) => ({
      ...prev,
      stages: toggleSegmentStageFilter(prev.stages, stage),
    }));
  }, []);

  const setAnnotation = useCallback((annotation: SegmentAnnotationFilter) => {
    setFilter((prev) => ({ ...prev, annotation }));
  }, []);

  const resetFilter = useCallback(() => {
    setFilter(resetSegmentListFilter());
  }, []);

  return {
    filter,
    filteredIndices,
    isActive,
    toggleStage,
    setAnnotation,
    resetFilter,
  };
}

export type SegmentListFilterApi = ReturnType<typeof useSegmentListFilter>;
