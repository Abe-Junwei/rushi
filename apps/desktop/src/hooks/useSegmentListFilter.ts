import { useCallback, useEffect, useMemo, useState } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import type { SegmentTextStage } from "../services/segmentTextStage";
import {
  computeFilteredSegmentIndices,
  deriveSegmentListFilterProjection,
  isDefaultSegmentListFilter,
  readStoredSegmentListFilter,
  resetSegmentListFilter,
  toggleSegmentStageFilter,
  writeStoredSegmentListFilter,
  type SegmentAnnotationFilter,
  type SegmentFrozenFilter,
  type SegmentSpeakerFilter,
  type SegmentListFilterState,
} from "../services/segmentListFilter";

export function useSegmentListFilter(_currentFileId: string | null, segments: SegmentDto[]) {
  const [filter, setFilter] = useState<SegmentListFilterState>(readStoredSegmentListFilter);

  useEffect(() => {
    writeStoredSegmentListFilter(filter);
  }, [filter]);

  useEffect(() => {
    setFilter((prev) => (prev.speaker === "all" ? prev : { ...prev, speaker: "all" }));
  }, [_currentFileId]);

  const isActive = !isDefaultSegmentListFilter(filter);

  const projection = useMemo(() => {
    const filteredIndices = computeFilteredSegmentIndices(segments, filter);
    const derived = deriveSegmentListFilterProjection(
      filteredIndices,
      segments.length,
      isActive,
    );
    return { filteredIndices, ...derived };
  }, [segments, filter, isActive]);

  const toggleStage = useCallback((stage: SegmentTextStage) => {
    setFilter((prev) => ({
      ...prev,
      stages: toggleSegmentStageFilter(prev.stages, stage),
    }));
  }, []);

  const setAnnotation = useCallback((annotation: SegmentAnnotationFilter) => {
    setFilter((prev) => ({ ...prev, annotation }));
  }, []);

  const setFrozen = useCallback((frozen: SegmentFrozenFilter) => {
    setFilter((prev) => ({ ...prev, frozen }));
  }, []);

  const setSpeaker = useCallback((speaker: SegmentSpeakerFilter) => {
    setFilter((prev) => ({ ...prev, speaker }));
  }, []);

  const resetFilter = useCallback(() => {
    setFilter(resetSegmentListFilter());
  }, []);

  return {
    filter,
    filteredIndices: projection.filteredIndices,
    visibleIndexSet: projection.visibleIndexSet,
    displayPositionByIndex: projection.displayPositionByIndex,
    isTrueSubset: projection.isTrueSubset,
    isActive,
    toggleStage,
    setAnnotation,
    setFrozen,
    setSpeaker,
    resetFilter,
  };
}

export type SegmentListFilterApi = ReturnType<typeof useSegmentListFilter>;
