import { useCallback } from "react";
import type { ProjectDetail, SegmentDto } from "../tauri/projectApi";
import { useGlossaryLearnPromptController } from "./useGlossaryLearnPromptController";
import { useManualCorrectionMemoryDialog } from "./useManualCorrectionMemoryDialog";
import { useProjectSaveController } from "./useProjectSaveController";
import { useSegmentAnnotationController } from "./useSegmentAnnotationController";
import { useSegmentDeleteConfirmController } from "./useSegmentDeleteConfirmController";
import { useSegmentDirtyState } from "./useSegmentDirtyState";
import { useSegmentMutationController } from "./useSegmentMutationController";
import { useSegmentSelectionController } from "./useSegmentSelectionController";
import { useAutoSaveSegments } from "./useAutoSaveSegments";
import type { BusyReason } from "./useProjectCrudController";

type UseProjectLifecycleEditorStackArgs = {
  busy: boolean;
  beginBusy: (reason: BusyReason) => void;
  endBusy: () => void;
  setError: React.Dispatch<React.SetStateAction<string>>;
  current: ProjectDetail | null;
  currentFileId: string | null;
  segments: SegmentDto[];
  segmentsRef: React.MutableRefObject<SegmentDto[]>;
  selectedIdx: number;
  setSelectedIdx: React.Dispatch<React.SetStateAction<number>>;
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
    segmentsRef,
    selectedIdx,
    setSelectedIdx,
    selectedIdxRef,
    setCurrent,
    setSegments,
    pendingAiRevisedUidsRef,
  } = args;

  const segmentSelection = useSegmentSelectionController({
    selectedIdx,
    setSelectedIdx,
    segmentCount: segments.length,
    resetKey: currentFileId,
    disabled: busy,
  });

  const mutations = useSegmentMutationController({
    segmentsRef,
    setSegments,
    selectedIdxRef,
    setSelectedIdx,
    setError,
    busy,
    pendingAiRevisedUidsRef,
    onSelectionCollapsed: segmentSelection.collapseTo,
  });

  const segmentDeleteConfirm = useSegmentDeleteConfirmController({
    segmentsRef,
    flushSegmentTextDrafts: mutations.flushSegmentTextDrafts,
    deleteSegmentAt: mutations.deleteSegmentAt,
    deleteSegmentRange: mutations.deleteSegmentRange,
    deleteSegmentIndices: mutations.deleteSegmentIndices,
  });

  const dirty = useSegmentDirtyState({
    currentFileId,
    segmentsRef,
    flushSegmentTextDrafts: mutations.flushSegmentTextDrafts,
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
    segmentsRef,
    selectedIdxRef,
    setCurrent,
    setSegments,
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
    segmentsRef,
    setSegments,
    saveSegments,
    pushUndo: mutations.pushUndo,
    setError,
  });

  const autoSave = useAutoSaveSegments({
    enabled: Boolean(currentFileId),
    currentFileId,
    segments,
    busy,
    saveInFlightRef,
    hasUnsavedSegmentChanges: dirty.hasUnsavedSegmentChanges,
    saveSegments,
    registerClearScheduled: (fn) => {
      clearAutoSaveRef.current = fn;
    },
    registerOnPersisted: (fn) => {
      notifySegmentsPersistedRef.current = fn;
    },
  });

  const clearScheduledAutoSave = useCallback(() => {
    clearAutoSaveRef.current();
  }, []);

  return {
    segmentSelection,
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
  };
}
