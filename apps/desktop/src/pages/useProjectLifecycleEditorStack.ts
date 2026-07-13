import { useCallback, useMemo, useRef } from "react";
import type { ProjectDetail, SegmentDto } from "../tauri/projectApi";
import { useGlossaryLearnPromptController } from "./useGlossaryLearnPromptController";
import { useManualCorrectionMemoryDialog } from "./useManualCorrectionMemoryDialog";
import { useProjectSaveController } from "./useProjectSaveController";
import { useSegmentAnnotationController } from "./useSegmentAnnotationController";
import { useSegmentDeleteConfirmController } from "./useSegmentDeleteConfirmController";
import { useSegmentDirtyState } from "./useSegmentDirtyState";
import { useSegmentMutationController } from "./useSegmentMutationController";
import { useTranscriptSelectionFromProjection } from "./useTranscriptSelectionFromProjection";
import { useAutoSaveSegments } from "./useAutoSaveSegments";
import type { BusyReason } from "./useProjectCrudController";
import { createSegmentPublishApi } from "./segmentPublishApi";
import { reconcileSegmentsRefWithState } from "./segmentSegmentsRefSync";
import { clampSegmentIndex } from "../utils/segmentSelection";
import { dispatchTranscriptEditorSelection } from "../components/editor/core/transcriptEditorViewHandle";
import {
  getStructurePlayheadSec,
  remapStructurePlayback,
} from "../services/segmentStructurePlaybackBridge";

type UseProjectLifecycleEditorStackArgs = {
  busy: boolean;
  beginBusy: (reason: BusyReason) => void;
  endBusy: () => void;
  setError: React.Dispatch<React.SetStateAction<string>>;
  current: ProjectDetail | null;
  currentFileId: string | null;
  segments: SegmentDto[];
  setSelectedIdx: (idx: number) => void;
  selectedIdxRef: React.MutableRefObject<number>;
  setCurrent: React.Dispatch<React.SetStateAction<ProjectDetail | null>>;
  setSegments: React.Dispatch<React.SetStateAction<SegmentDto[]>>;
  pendingAiRevisedUidsRef: React.MutableRefObject<Set<string>>;
};

export function useProjectLifecycleEditorStack(args: UseProjectLifecycleEditorStackArgs) {
  const {
    busy,
    beginBusy,
    endBusy,
    setError,
    current,
    currentFileId,
    segments,
    setSelectedIdx,
    selectedIdxRef,
    setCurrent,
    setSegments,
    pendingAiRevisedUidsRef,
  } = args;

  const segmentSelection = useTranscriptSelectionFromProjection({
    segmentCount: segments.length,
    selectedIdxRef,
    disabled: busy,
  });

  const segmentsRef = useRef(segments);
  reconcileSegmentsRefWithState(segmentsRef, segments);

  const segmentPublish = useMemo(
    () => createSegmentPublishApi(segmentsRef, setSegments),
    [segmentsRef, setSegments],
  );

  const getCurrentSegmentsSnapshot = segmentPublish.getCurrentSegmentsSnapshot;

  const onSelectionCollapsed = useCallback(
    (idx: number) => {
      segmentSelection.collapseTo(idx);
    },
    [segmentSelection],
  );

  const onSegmentsStructureRestored = useCallback(() => {
    const segs = getCurrentSegmentsSnapshot();
    const idx = clampSegmentIndex(selectedIdxRef.current, segs.length);
    segmentSelection.collapseTo(idx);
  }, [getCurrentSegmentsSnapshot, segmentSelection, selectedIdxRef]);

  const clearMultiSelectionWithChrome = useCallback(() => {
    if (segmentSelection.selectionCount <= 1) return;
    const primary = clampSegmentIndex(selectedIdxRef.current, segments.length);
    segmentSelection.clearMultiSelection();
    dispatchTranscriptEditorSelection(primary);
  }, [segmentSelection, segments.length, selectedIdxRef]);

  const mutations = useSegmentMutationController({
    segmentPublish,
    selectedIdxRef,
    setSelectedIdx,
    setError,
    busy,
    pendingAiRevisedUidsRef,
    onSelectionCollapsed,
    onSegmentsStructureRestored,
    getPlayheadSec: getStructurePlayheadSec,
    onStructurePlaybackRemap: remapStructurePlayback,
  });

  const segmentDeleteConfirm = useSegmentDeleteConfirmController({
    getCurrentSegmentsSnapshot: segmentPublish.getCurrentSegmentsSnapshot,
    flushSegmentTextDrafts: mutations.flushSegmentTextDrafts,
    deleteSegmentAt: mutations.deleteSegmentAt,
    deleteSegmentRange: mutations.deleteSegmentRange,
    deleteSegmentIndices: mutations.deleteSegmentIndices,
  });

  const dirty = useSegmentDirtyState({
    currentFileId,
    getCurrentSegmentsSnapshot,
  });

  const glossaryLearn = useGlossaryLearnPromptController({ setError });
  const manualCorrectionMemory = useManualCorrectionMemoryDialog({
    busy,
    setError,
    checkGlossaryLearnAfterSave: glossaryLearn.checkGlossaryLearnAfterSave,
  });

  const saveController = useProjectSaveController({
    busy,
    current,
    currentFileId,
    segmentPublish,
    selectedIdxRef,
    setCurrent,
    setSelectedIdx,
    setError,
    beginBusy,
    endBusy,
    mutations,
    dirty,
    pendingAiRevisedUidsRef,
    checkGlossaryLearnAfterSave: () => {
      void glossaryLearn.checkGlossaryLearnAfterSave();
    },
  });

  const {
    saveInFlightRef,
    clearAutoSaveRef,
    notifySegmentsPersistedRef,
    saveSegments,
  } = saveController;

  const segmentAnnotation = useSegmentAnnotationController({
    busy,
    segmentPublish,
    saveSegments,
    pushUndo: mutations.pushUndo,
    setError,
  });

  /* eslint-disable react-hooks/exhaustive-deps -- clearAutoSaveRef is a stable ref; assigning .current does not need dep */
  const registerClearScheduled = useCallback((fn: () => void) => {
    clearAutoSaveRef.current = fn;
  }, []);
  /* eslint-enable react-hooks/exhaustive-deps */

  /* eslint-disable react-hooks/exhaustive-deps -- notifySegmentsPersistedRef is a stable ref; assigning .current does not need dep */
  const registerOnPersisted = useCallback((fn: () => void) => {
    notifySegmentsPersistedRef.current = fn;
  }, []);
  /* eslint-enable react-hooks/exhaustive-deps */

  const autoSave = useAutoSaveSegments({
    enabled: Boolean(currentFileId),
    currentFileId,
    segments,
    busy,
    saveInFlightRef,
    hasUnsavedSegmentChanges: dirty.hasUnsavedSegmentChanges,
    saveSegments,
    registerClearScheduled,
    registerOnPersisted,
  });

  /* eslint-disable react-hooks/exhaustive-deps -- clearAutoSaveRef is a stable ref; calling .current() does not need dep */
  const clearScheduledAutoSave = useCallback(() => {
    clearAutoSaveRef.current();
  }, []);
  /* eslint-enable react-hooks/exhaustive-deps */

  return {
    segmentSelection,
    clearMultiSelectionWithChrome,
    mutations,
    segmentDeleteConfirm,
    dirty,
    glossaryLearn,
    manualCorrectionMemory,
    saveController,
    saveSegments,
    segmentAnnotation,
    autoSave,
    clearScheduledAutoSave,
    getCurrentSegmentsSnapshot,
    segmentPublish,
  };
}
