import { useCallback, useEffect, useMemo, useState } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import type { SegmentTextStage } from "../services/segmentTextStage";
import {
  computeFilteredSegmentIndices,
  isDefaultSegmentListFilter,
  readStoredSegmentListFilter,
  resetSegmentListFilter,
  toggleSegmentStageFilter,
  writeStoredSegmentListFilter,
  type SegmentAnnotationFilter,
  type SegmentListFilterState,
} from "../services/segmentListFilter";

export function useSegmentListFilter(_currentFileId: string | null, segments: SegmentDto[]) {
  const [filter, setFilter] = useState<SegmentListFilterState>(readStoredSegmentListFilter);

  useEffect(() => {
    writeStoredSegmentListFilter(filter);
  }, [filter]);

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
