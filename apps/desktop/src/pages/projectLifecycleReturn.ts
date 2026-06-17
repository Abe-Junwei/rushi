import type { ProjectLifecycleApi } from "./ProjectLifecycleApi";
import type { CloseGateLifecycleFacade, ExportLifecycleFacade } from "./projectLifecycleFacades";
import { deriveTranscribePreviewActive } from "./projectLifecycleFacades";
import { mapEditorToolsLifecycleFields } from "./projectLifecycleEditorToolsReturn";
import type { useProjectEditorToolsController } from "./useProjectEditorToolsController";
import type { useTranscribeJobController } from "./useTranscribeJobController";
import type { useSegmentMutationController } from "./useSegmentMutationController";
import type { useSegmentSelectionController } from "./useSegmentSelectionController";
import type { useSegmentDeleteConfirmController } from "./useSegmentDeleteConfirmController";
import type { useGlossaryLearnPromptController } from "./useGlossaryLearnPromptController";
import type { useManualCorrectionMemoryDialog } from "./useManualCorrectionMemoryDialog";
import type { useProjectImportDuplicateController } from "./useProjectImportDuplicateController";
import type { useProjectFileMutationController } from "./useProjectFileMutationController";
import type { useProjectMutationController } from "./useProjectMutationController";
import type { useSegmentAnnotationController } from "./useSegmentAnnotationController";
import type { useBatchTranscribeQueueController } from "./useBatchTranscribeQueueController";
import type { useProjectCrudController } from "./useProjectCrudController";
import type { useProjectSaveController } from "./useProjectSaveController";
import type { useAutoSaveSegments } from "./useAutoSaveSegments";
import type { useSegmentDirtyState } from "./useSegmentDirtyState";
import type { BusyReason } from "./useProjectCrudController";
import type { ProjectDetail, ProjectSummary, SegmentDto } from "../tauri/projectApi";
import { readFocusedSegmentTextareaIdx } from "./flushSegmentTextDrafts";

type EditorTools = ReturnType<typeof useProjectEditorToolsController>;
type TranscribeJob = ReturnType<typeof useTranscribeJobController>;
type Mutations = ReturnType<typeof useSegmentMutationController>;
type SegmentSelection = ReturnType<typeof useSegmentSelectionController>;
type SegmentDeleteConfirm = ReturnType<typeof useSegmentDeleteConfirmController>;
type GlossaryLearn = ReturnType<typeof useGlossaryLearnPromptController>;
type ManualCorrectionMemory = ReturnType<typeof useManualCorrectionMemoryDialog>;
type ImportDuplicate = ReturnType<typeof useProjectImportDuplicateController>;
type FileMutation = ReturnType<typeof useProjectFileMutationController>;
type ProjectMutation = ReturnType<typeof useProjectMutationController>;
type SegmentAnnotation = ReturnType<typeof useSegmentAnnotationController>;
type BatchTranscribe = ReturnType<typeof useBatchTranscribeQueueController>;
type Crud = ReturnType<typeof useProjectCrudController>;
type SaveController = ReturnType<typeof useProjectSaveController>;
type AutoSave = ReturnType<typeof useAutoSaveSegments>;
type Dirty = ReturnType<typeof useSegmentDirtyState>;

export type ProjectLifecycleReturnInput = {
  projects: ProjectSummary[];
  current: ProjectDetail | null;
  currentFileId: string | null;
  segments: SegmentDto[];
  selectedIdx: number;
  setSelectedIdx: React.Dispatch<React.SetStateAction<number>>;
  audioSrc: string | null;
  audioStoragePath: string | null;
  error: string;
  busy: boolean;
  busyReason: BusyReason | null;
  newName: string;
  setNewName: React.Dispatch<React.SetStateAction<string>>;
  pickedPath: string | null;
  refreshProjects: () => Promise<void>;
  pickAudio: () => Promise<void>;
  clearPickedAudio: () => void;
  refreshCurrentProject: () => Promise<void>;
  openAppDataFolder: () => Promise<void>;
  applyDetail: (detail: ProjectDetail) => void;
  setError: React.Dispatch<React.SetStateAction<string>>;
  beginBusy: (reason: BusyReason) => void;
  endBusy: () => void;
  selectedIdxRef: React.MutableRefObject<number>;
  getCurrentSegmentsSnapshot: () => SegmentDto[];
  closeGateFacade: CloseGateLifecycleFacade;
  exportFacade: ExportLifecycleFacade;
  transcribeJob: TranscribeJob;
  editorTools: EditorTools;
  crud: Crud;
  saveController: SaveController;
  autoSave: AutoSave;
  dirty: Dirty;
  mutations: Mutations;
  segmentSelection: SegmentSelection;
  segmentDeleteConfirm: SegmentDeleteConfirm;
  glossaryLearn: GlossaryLearn;
  manualCorrectionMemory: ManualCorrectionMemory;
  importDuplicate: ImportDuplicate;
  fileMutation: FileMutation;
  projectMutation: ProjectMutation;
  segmentAnnotation: SegmentAnnotation;
  batchTranscribe: BatchTranscribe;
};

/** 将子 controller 字段组装为 ProjectLifecycleApi return。 */
export function buildProjectLifecycleReturn(input: ProjectLifecycleReturnInput): ProjectLifecycleApi {
  const {
    projects,
    current,
    currentFileId,
    segments,
    selectedIdx,
    setSelectedIdx,
    audioSrc,
    audioStoragePath,
    error,
    busy,
    busyReason,
    newName,
    setNewName,
    pickedPath,
    refreshProjects,
    pickAudio,
    clearPickedAudio,
    refreshCurrentProject,
    openAppDataFolder,
    applyDetail,
    setError,
    beginBusy,
    endBusy,
    selectedIdxRef,
    getCurrentSegmentsSnapshot,
    closeGateFacade,
    exportFacade,
    transcribeJob,
    editorTools,
    crud,
    saveController,
    autoSave,
    dirty,
    mutations,
    segmentSelection,
    segmentDeleteConfirm,
    glossaryLearn,
    manualCorrectionMemory,
    importDuplicate,
    fileMutation,
    projectMutation,
    segmentAnnotation,
    batchTranscribe,
  } = input;

  const {
    saveSegments,
    confirmSegmentEditAndAdvance,
    markSegmentFinalized,
    restoreEditorFromEditLog,
  } = saveController;

  return {
    projects,
    current,
    currentFileId,
    segments,
    selectedIdx,
    setSelectedIdx,
    audioSrc,
    audioStoragePath,
    error,
    busy,
    busyReason,
    newName,
    setNewName,
    pickedPath,
    transcribeHints: transcribeJob.transcribeHints,
    transcribeFailureDiag: transcribeJob.transcribeFailureDiag,
    setTranscribeFailureDiag: transcribeJob.setTranscribeFailureDiag,
    transcribeProgress: transcribeJob.transcribeProgress,
    transcribeCancelling: transcribeJob.transcribeCancelling,
    transcribePreviewActive: deriveTranscribePreviewActive(busy, busyReason),
    transcribeStartDialogOpen: transcribeJob.transcribeStartDialogOpen,
    transcribeStartHasExistingText: transcribeJob.transcribeStartHasExistingText,
    transcribeOverwriteSegmentCount: transcribeJob.overwriteSegmentCount,
    transcribeVocabularyPreflightLines: transcribeJob.transcribeVocabularyPreflightLines,
    transcribeSource: transcribeJob.transcribeSource,
    setTranscribeSource: transcribeJob.setTranscribeSource,
    onlineTranscribeReady: transcribeJob.onlineTranscribeReady,
    refreshProjects,
    pickAudio,
    clearPickedAudio,
    createProject: crud.createProject,
    createEmptyProject: crud.createEmptyProject,
    createProjectFromText: crud.createProjectFromText,
    ...closeGateFacade,
    refreshCurrentProject,
    restoreEditorFromEditLog,
    runTranscribe: transcribeJob.requestTranscribe,
    cancelTranscribe: transcribeJob.cancelTranscribe,
    confirmTranscribeStart: transcribeJob.confirmTranscribeStart,
    cancelTranscribeStart: transcribeJob.cancelTranscribeStart,
    saveSegments,
    confirmSegmentEditAndAdvance,
    markSegmentFinalized,
    getSavedSnapshot: dirty.getSavedSnapshot,
    autoSaveFooterStatus: autoSave.autoSaveFooterStatus,
    ...mapEditorToolsLifecycleFields(editorTools),
    deleteProject: crud.deleteProject,
    ...exportFacade,
    openAppDataFolder,
    applyDetail,
    setError,
    beginBusy,
    endBusy,
    undo: mutations.undo,
    redo: mutations.redo,
    updateSegmentText: mutations.updateSegmentText,
    updateSegmentTime: mutations.updateSegmentTime,
    updateSegmentBounds: mutations.updateSegmentBounds,
    splitAtSelection: () => mutations.splitAtSelection(selectedIdxRef.current),
    splitAtPlayhead: mutations.splitAtPlayhead,
    mergeWithNext: () => {
      const focusIdx = readFocusedSegmentTextareaIdx(getCurrentSegmentsSnapshot().length);
      mutations.mergeWithNext(focusIdx ?? selectedIdxRef.current);
    },
    mergeWithPrev: () => {
      const focusIdx = readFocusedSegmentTextareaIdx(getCurrentSegmentsSnapshot().length);
      mutations.mergeWithPrev(focusIdx ?? selectedIdxRef.current);
    },
    mergeWithNextAt: mutations.mergeWithNextAt,
    mergeWithPrevAt: mutations.mergeWithPrevAt,
    mergeSegmentRange: mutations.mergeSegmentRange,
    deleteSegmentAt: segmentDeleteConfirm.requestDeleteSegmentAt,
    requestDeleteSelection: segmentDeleteConfirm.requestDeleteSelection,
    requestDeleteSelectedIndices: segmentDeleteConfirm.requestDeleteSelectedIndices,
    pendingDeleteCount: segmentDeleteConfirm.pendingDeleteCount,
    segmentDeleteConfirmOpen: segmentDeleteConfirm.segmentDeleteConfirmOpen,
    confirmDeleteSegment: segmentDeleteConfirm.confirmDeleteSegment,
    cancelDeleteSegment: segmentDeleteConfirm.cancelDeleteSegment,
    selectionLo: segmentSelection.selectionLo,
    selectionHi: segmentSelection.selectionHi,
    selectionCount: segmentSelection.selectionCount,
    isMultiSegmentSelection: segmentSelection.isMultiSegmentSelection,
    isContiguousSelection: segmentSelection.isContiguousSelection,
    selectedIndices: segmentSelection.selectedIndices,
    selectedIndicesArray: segmentSelection.selectedIndicesArray,
    isIndexInSelection: segmentSelection.isIndexInSelection,
    selectSegmentAt: segmentSelection.selectSegmentAt,
    selectSegmentRange: segmentSelection.selectSegmentRange,
    selectSegmentIndices: segmentSelection.selectSegmentIndices,
    clearMultiSelection: segmentSelection.clearMultiSelection,
    insertSegmentAfter: mutations.insertSegmentAfter,
    insertSegmentFromTimeRange: mutations.insertSegmentFromTimeRange,
    flushSegmentTextDrafts: mutations.flushSegmentTextDrafts,
    glossaryLearnDialog: glossaryLearn.glossaryLearnDialog,
    dismissGlossaryLearnPrompt: glossaryLearn.dismissGlossaryLearnPrompt,
    confirmAddToGlossary: (row) => {
      void glossaryLearn.confirmAddToGlossary(row);
    },
    closeGlossaryLearnPrompt: glossaryLearn.closeGlossaryLearnPrompt,
    manualCorrectionMemoryDialog: manualCorrectionMemory.manualCorrectionMemoryDialog,
    openManualCorrectionMemoryDialog: manualCorrectionMemory.openManualCorrectionMemoryDialog,
    closeManualCorrectionMemoryDialog: manualCorrectionMemory.closeManualCorrectionMemoryDialog,
    setManualCorrectionRight: manualCorrectionMemory.setManualCorrectionRight,
    setManualCorrectionAlsoGlossary: manualCorrectionMemory.setManualCorrectionAlsoGlossary,
    confirmManualCorrectionMemory: () => {
      void manualCorrectionMemory.confirmManualCorrectionMemory();
    },
    duplicateImportConfirmOpen: importDuplicate.duplicateImportConfirmOpen,
    duplicateImportChecking: importDuplicate.duplicateImportChecking,
    duplicateImportCheck: importDuplicate.duplicateImportCheck,
    cancelDuplicateImport: importDuplicate.cancelDuplicateImport,
    openExistingDuplicateImport: importDuplicate.openExistingDuplicateImport,
    confirmDuplicateImportCopy: importDuplicate.confirmDuplicateImportCopy,
    importFileToProject: importDuplicate.importFileToProject,
    pickAndImportFileToProject: importDuplicate.pickAndImportFileToProject,
    pickAndImportAudioPathsToProject: importDuplicate.pickAndImportAudioPathsToProject,
    batchQueueOpen: batchTranscribe.batchQueueOpen,
    batchQueueItems: batchTranscribe.batchQueueItems,
    batchTranscribeRunning: batchTranscribe.batchTranscribeRunning,
    batchTranscribableCount: batchTranscribe.batchTranscribableCount,
    canStartBatchTranscribe: batchTranscribe.canStartBatchTranscribe,
    startBatchTranscribe: async () => {
      await batchTranscribe.startBatchTranscribe();
    },
    closeBatchQueueDialog: batchTranscribe.closeBatchQueueDialog,
    renamingProjectFileId: fileMutation.renamingProjectFileId,
    renameProjectFileDraft: fileMutation.renameProjectFileDraft,
    setRenameProjectFileDraft: fileMutation.setRenameProjectFileDraft,
    beginRenameProjectFile: fileMutation.beginRenameProjectFile,
    cancelRenameProjectFile: fileMutation.cancelRenameProjectFile,
    commitRenameProjectFile: () => void fileMutation.commitRenameProjectFile(),
    pendingProjectFileDelete: fileMutation.pendingProjectFileDelete,
    requestDeleteProjectFile: fileMutation.requestDeleteProjectFile,
    cancelDeleteProjectFile: fileMutation.cancelDeleteProjectFile,
    confirmDeleteProjectFile: () => void fileMutation.confirmDeleteProjectFile(),
    isRenamingProject: projectMutation.isRenamingProject,
    renameProjectDraft: projectMutation.renameProjectDraft,
    setRenameProjectDraft: projectMutation.setRenameProjectDraft,
    beginRenameProject: projectMutation.beginRenameProject,
    cancelRenameProject: projectMutation.cancelRenameProject,
    commitRenameProject: () => void projectMutation.commitRenameProject(),
    projectMetadataDialogOpen: projectMutation.projectMetadataDialogOpen,
    projectMetadataAfterCreate: projectMutation.projectMetadataAfterCreate,
    openProjectMetadataDialog: projectMutation.openProjectMetadataDialog,
    closeProjectMetadataDialog: projectMutation.closeProjectMetadataDialog,
    saveProjectMetadata: (metadata) => void projectMutation.saveProjectMetadata(metadata),
    pendingProjectDelete: projectMutation.pendingProjectDelete,
    requestDeleteProject: projectMutation.requestDeleteProject,
    cancelDeleteProject: projectMutation.cancelDeleteProject,
    confirmDeleteProject: () => void projectMutation.confirmDeleteProject(),
    segmentAnnotationDialog: segmentAnnotation.segmentAnnotationDialog,
    segmentAnnotationSaving: segmentAnnotation.segmentAnnotationSaving,
    openSegmentAnnotationDialog: segmentAnnotation.openSegmentAnnotationDialog,
    closeSegmentAnnotationDialog: segmentAnnotation.closeSegmentAnnotationDialog,
    setSegmentAnnotationDraft: segmentAnnotation.setSegmentAnnotationDraft,
    saveSegmentAnnotation: segmentAnnotation.saveSegmentAnnotation,
    clearSegmentAnnotation: segmentAnnotation.clearSegmentAnnotation,
  };
}
