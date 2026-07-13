import type { ProjectDetail, ProjectSummary, SegmentDto } from "../tauri/projectApi";
import type { DocxExportMode } from "../tauri/exportDocxApi";
import type { DeliveryDocxExportRequest } from "./useExportController";
import type { SegmentOverlapPolicy } from "../utils/segmentTimeRange";
import type { FindReplaceDialogState } from "./useFindReplaceController";
import type { CorrectionRulesDialogState } from "./useCorrectionRulesController";
import type { PostTranscribeStageBDialogState } from "./usePostTranscribeStageBController";
import type { GlossaryLearnPromptDialogState } from "./useGlossaryLearnPromptController";
import type { GlossaryLearnPromptRow } from "../tauri/correctionApi";
import type { WorkspaceFileTarget } from "../services/lastWorkspace";
import type { BusyReason } from "./useProjectCrudController";

export type { BusyReason };

export interface ProjectLifecycleApi {
  projects: ProjectSummary[];
  current: ProjectDetail | null;
  currentFileId: string | null;
  segments: SegmentDto[];
  selectedIdx: number;
  selectedIdxRef: React.MutableRefObject<number>;
  setSelectedIdx: (idx: number) => void;
  audioSrc: string | null;
  /** Raw on-disk audio path for Tauri blob URL load (bypasses asset:// truncation). */
  audioStoragePath: string | null;
  error: string;
  busy: boolean;
  busyReason: BusyReason | null;
  newName: string;
  setNewName: React.Dispatch<React.SetStateAction<string>>;
  pickedPath: string | null;
  transcribeHints: string[];
  transcribeFailureDiag: import("../services/transcribeDiag").TranscribeTimelineSnapshot | null;
  setTranscribeFailureDiag: React.Dispatch<
    React.SetStateAction<import("../services/transcribeDiag").TranscribeTimelineSnapshot | null>
  >;
  transcribeProgress: import("./transcribePreviewState").TranscribeProgress | null;
  transcribeCancelling: boolean;
  transcribePreviewActive: boolean;
  transcribeOverwriteSegmentCount: number;
  transcribeVocabularyPreflightLines: string[];
  transcribeSource: import("../services/stt/transcribeSource").TranscribeSource;
  setTranscribeSource: (source: import("../services/stt/transcribeSource").TranscribeSource) => void;
  onlineTranscribeReady: boolean;
  refreshProjects: () => Promise<void>;
  pickAudio: () => Promise<void>;
  clearPickedAudio: () => void;
  createProject: () => Promise<void>;
  createEmptyProject: () => Promise<void>;
  createProjectFromText: () => Promise<void>;
  loadProject: (id: string) => Promise<void>;
  loadProjectAfterImport: (id: string, preferFileId?: string | null) => Promise<void>;
  openFile: (fileId: string) => Promise<void>;
  openLastEditorWorkspace: () => Promise<void>;
  openWorkspaceFile: (projectId: string, fileId: string) => Promise<void>;
  openingWorkspaceTarget: WorkspaceFileTarget | null;
  closeFile: () => void;
  closeProject: () => void;
  refreshCurrentProject: () => Promise<void>;
  runTranscribe: () => Promise<void>;
  cancelTranscribe: () => Promise<void>;
  transcribeStartDialogOpen: boolean;
  transcribeStartHasExistingText: boolean;
  confirmTranscribeStart: () => void | Promise<void>;
  cancelTranscribeStart: () => void;
  saveSegments: (options?: {
    quiet?: boolean;
    countHits?: boolean;
    explicitPairs?: import("../tauri/fileApi").CorrectionExplicitPair[];
  }) => Promise<boolean>;
  /** Enter：落笔保存未提交正文并选中下一语段。 */
  confirmSegmentEditAndAdvance: (segmentIdx: number) => Promise<boolean>;
  markSegmentFinalized: (segmentIdx: number) => Promise<boolean>;
  manualCorrectionMemoryDialog: import("./useManualCorrectionMemoryDialog").ManualCorrectionMemoryDialogState;
  openManualCorrectionMemoryDialog: (wrong: string) => void;
  closeManualCorrectionMemoryDialog: () => void;
  setManualCorrectionRight: (right: string) => void;
  setManualCorrectionAlsoGlossary: (value: boolean) => void;
  confirmManualCorrectionMemory: () => void;
  canConfirmSegmentEdit: (segmentIdx: number) => boolean;
  getSavedSnapshot: () => import("../tauri/projectApi").SegmentDto[];
  editorSpansForText: (text: string) => import("../services/editor/findCorrectableSpans").CorrectableSpan[];
  editorCorrectPopover: import("./useEditorSegmentCorrectPopover").SegmentCorrectPopoverState | null;
  editorCorrectPopoverSuggestions: import("../services/editor/correctSuggestions").CorrectSuggestion[];
  openEditorCorrectPopover: (
    segmentIdx: number,
    span: import("../services/editor/findCorrectableSpans").CorrectableSpan,
    clientX: number,
    clientY: number,
  ) => void;
  closeEditorCorrectPopover: () => void;
  applyEditorInlineCorrection: (item: import("../services/editor/correctSuggestions").CorrectSuggestion) => void;
  autoSaveFooterStatus: import("./useAutoSaveSegments").AutoSaveFooterStatus;
  deleteProject: (id: string, options?: { skipBrowserConfirm?: boolean }) => Promise<void>;
  exportTxt: () => Promise<void>;
  exportSrt: () => Promise<void>;
  exportDocx: (mode: DocxExportMode) => Promise<void>;
  exportDeliveryDocx: (request: DeliveryDocxExportRequest) => Promise<void>;
  exportDiagnosticBundle: () => Promise<void>;
  exportProjectBundle: () => Promise<void>;
  importProjectBundle: () => Promise<void>;
  openAppDataFolder: () => Promise<void>;
  applyDetail: (d: ProjectDetail) => void;
  setError: React.Dispatch<React.SetStateAction<string>>;
  beginBusy: (reason: BusyReason) => void;
  endBusy: () => void;

  undo: () => void;
  redo: () => void;
  updateSegmentText: (idx: number, text: string) => void;
  updateSegmentTime: (idx: number, field: "start_sec" | "end_sec", value: number) => void;
  updateSegmentBounds: (
    idx: number,
    startSec: number,
    endSec: number,
    phase?: "live" | "commit",
    options?: {
      neighborPatches?: Array<{ idx: number; startSec: number; endSec: number }>;
      deleteIndices?: number[];
    },
  ) => void;
  splitAtSelection: () => void;
  splitAtPlayhead: (timeSec: number) => void;
  mergeWithNext: () => void;
  mergeWithPrev: () => void;
  mergeWithNextAt: (idx: number) => void;
  mergeWithPrevAt: (idx: number) => void;
  mergeSegmentRange: (lo: number, hi: number) => void;
  deleteSegmentAt: (idx: number) => void;
  requestDeleteSelection: (lo: number, hi: number) => void;
  pendingDeleteCount: number;
  segmentDeleteConfirmOpen: boolean;
  confirmDeleteSegment: () => void;
  cancelDeleteSegment: () => void;
  selectionLo: number;
  selectionHi: number;
  selectionRangeAnchorIdx: number;
  selectionCount: number;
  isMultiSegmentSelection: boolean;
  isContiguousSelection: boolean;
  selectedIndices: ReadonlySet<number>;
  selectedIndicesArray: number[];
  isIndexInSelection: (idx: number) => boolean;
  selectSegmentAt: (idx: number, opts?: { shiftKey?: boolean; toggle?: boolean }) => void;
  selectSegmentRange: (lo: number, hi: number) => void;
  selectSegmentIndices: (indices: number[], primaryIdx: number) => void;
  clearMultiSelection: () => void;
  requestDeleteSelectedIndices: (indices: number[]) => void;
  insertSegmentAfter: (idx: number, mediaDurationSec?: number) => void;
  insertSegmentFromTimeRange: (
    startSec: number,
    endSec: number,
    mediaDurationSec?: number,
    policy?: SegmentOverlapPolicy,
  ) => number | null;
  flushSegmentTextDrafts: () => void;
  canFindReplace: boolean;
  findReplaceBlockReason: string | null;
  findReplaceDialog: FindReplaceDialogState;
  openFindReplace: (initialFind?: string, initialReplace?: string) => void;
  triggerFindReplaceShortcut: () => void;
  closeFindReplace: () => void;
  setFindReplaceFindText: (value: string) => void;
  setFindReplaceReplaceText: (value: string) => void;
  findReplaceRunSearch: () => void;
  findReplaceSelectMatch: (globalIndex: number) => void;
  findReplaceGoNext: () => void;
  findReplaceGoPrev: () => void;
  findReplaceCurrent: () => void;
  findReplaceRequestReplaceAll: () => void;
  findReplaceConfirmReplaceAll: () => Promise<void>;
  findReplaceCancelReplaceAllPreview: () => void;
  findReplaceEditorHighlight: { segmentIdx: number; charStart: number; charEnd: number } | null;
  findReplaceReplaceAndNext: () => void;
  canApplyCorrectionRules: boolean;
  correctionRulesBlockReason: string | null;
  correctionRulesDialog: CorrectionRulesDialogState;
  correctionRulesStableConflictMessage: string | null;
  requestCorrectionRules: () => void;
  requestPostTranscribeProcessing: () => void;
  openCorrectionRulesManual: () => void;
  confirmCorrectionRulesWriteback: () => void | Promise<void>;
  toggleCorrectionRulesSegment: (segmentIdx: number) => void;
  focusCorrectionRulesPreviewSegment: (segmentIdx: number) => void;
  correctionRulesEditorHighlight: {
    segmentIdx: number;
    charStart: number;
    charEnd: number;
  } | null;
  cancelCorrectionRules: () => void;
  closeCorrectionRulesEmpty: () => void;
  canOfferPostTranscribeStageB: boolean;
  postTranscribeStageBBlockReason: string | null;
  postTranscribeStageBDialog: PostTranscribeStageBDialogState;
  /** 工具栏「智能改稿」：与规则纠错独立，不经过阶段 A 门禁。 */
  openPostTranscribeStageB: () => void;
  confirmPostTranscribeStageBConsent: () => void;
  confirmPostTranscribeStageBWriteback: () => void | Promise<void>;
  togglePostTranscribeStageBSegment: (segmentIdx: number) => void;
  focusPostTranscribeStageBSegment: (segmentIdx: number) => void;
  postTranscribeStageBPreviewFocusSegmentIdx: number | null;
  cancelPostTranscribeStageB: () => void;
  glossaryLearnDialog: GlossaryLearnPromptDialogState;
  dismissGlossaryLearnPrompt: (row: GlossaryLearnPromptRow) => void;
  confirmAddToGlossary: (row: GlossaryLearnPromptRow) => void;
  closeGlossaryLearnPrompt: () => void;
  restoreEditorFromEditLog: (editLogId: number) => Promise<void>;
  bumpLlmRuntimeChanged: () => void;
  closeGateOpen: boolean;
  closeGateIntent: "app-quit" | "navigate";
  stayAfterCloseAttempt: () => void;
  discardUnsavedAndClose: () => void;
  saveAndClose: () => void;
  duplicateImportConfirmOpen: boolean;
  duplicateImportChecking: boolean;
  duplicateImportCheck: import("../utils/projectImportDuplicate").ImportDuplicateCheck | null;
  cancelDuplicateImport: () => void;
  openExistingDuplicateImport: () => void;
  confirmDuplicateImportCopy: () => void;
  attachImportTargetOpen: boolean;
  attachImportTargetCandidates: import("../tauri/projectTypes").FileSummary[];
  attachImportTargetStem: string | null;
  cancelAttachImportTarget: () => void;
  confirmAttachImportTarget: (fileId: string) => void;
  importFileToProject: (
    kind: "audio" | "text",
    srcPath: string,
    options?: import("./useProjectImportDuplicateController").ImportFileToProjectOptions,
  ) => Promise<boolean>;
  pickAndImportFileToProject: (
    kind: "audio" | "text",
    options?: import("./useProjectImportDuplicateController").ImportFileToProjectOptions,
  ) => Promise<boolean>;
  pickAndImportAudioPathsToProject: () => Promise<{ imported: number; skipped: number }>;
  batchQueueOpen: boolean;
  batchQueueItems: import("../services/batchTranscribeQueue").BatchQueueItem[];
  batchTranscribeRunning: boolean;
  batchTranscribableCount: number;
  canStartBatchTranscribe: boolean;
  startBatchTranscribe: () => Promise<void>;
  cancelBatchTranscribe: () => Promise<void>;
  closeBatchQueueDialog: () => void;
  transcribeNavBlockOpen: boolean;
  transcribeNavBlockStopping: boolean;
  cancelTranscribeNavBlock: () => void;
  confirmTranscribeNavBlock: () => Promise<void>;
  hasUnsavedFileEdits: () => boolean;
  renamingProjectFileId: string | null;
  renameProjectFileDraft: string;
  setRenameProjectFileDraft: (value: string) => void;
  beginRenameProjectFile: (fileId: string, currentName: string) => void;
  cancelRenameProjectFile: () => void;
  commitRenameProjectFile: () => void;
  pendingProjectFileDelete: import("./useProjectFileMutationController").PendingProjectFileDelete;
  requestDeleteProjectFile: (fileId: string, fileName: string) => void;
  cancelDeleteProjectFile: () => void;
  confirmDeleteProjectFile: () => void;
  isRenamingProject: boolean;
  renameProjectDraft: string;
  setRenameProjectDraft: (value: string) => void;
  beginRenameProject: (currentName: string) => void;
  cancelRenameProject: () => void;
  commitRenameProject: () => void;
  projectMetadataDialogOpen: boolean;
  projectMetadataAfterCreate: boolean;
  openProjectMetadataDialog: (options?: { afterCreate?: boolean }) => void;
  closeProjectMetadataDialog: () => void;
  saveProjectMetadata: (form: import("./useProjectMutationController").ProjectMetadataForm) => void;
  pendingProjectDelete: import("./useProjectMutationController").PendingProjectDelete;
  requestDeleteProject: (projectId: string, projectName: string) => void;
  cancelDeleteProject: () => void;
  confirmDeleteProject: () => void;
  segmentAnnotationDialog: import("./useSegmentAnnotationController").SegmentAnnotationDialogState;
  segmentAnnotationSaving: boolean;
  openSegmentAnnotationDialog: (segmentIdx: number) => void;
  closeSegmentAnnotationDialog: () => void;
  setSegmentAnnotationDraft: (draft: string) => void;
  saveSegmentAnnotation: () => Promise<boolean>;
  clearSegmentAnnotation: () => Promise<boolean>;
}
