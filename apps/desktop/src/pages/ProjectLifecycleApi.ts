import type { ProjectDetail, ProjectSummary, SegmentDto } from "../tauri/projectApi";
import type { DocxExportMode } from "../tauri/exportDocxApi";
import type { SegmentOverlapPolicy } from "../utils/segmentTimeRange";
import type { SegmentRefineDialogState } from "./useSegmentRefineController";
import type { AutoPunctuateDialogState } from "./useAutoPunctuateController";
import type { BusyReason } from "./useProjectCrudController";

export type { BusyReason };

export interface ProjectLifecycleApi {
  projects: ProjectSummary[];
  current: ProjectDetail | null;
  currentFileId: string | null;
  segments: SegmentDto[];
  selectedIdx: number;
  setSelectedIdx: React.Dispatch<React.SetStateAction<number>>;
  audioSrc: string | null;
  error: string;
  busy: boolean;
  busyReason: BusyReason | null;
  newName: string;
  setNewName: React.Dispatch<React.SetStateAction<string>>;
  pickedPath: string | null;
  transcribeHints: string[];
  transcribeProgress: import("./transcribePreviewState").TranscribeProgress | null;
  transcribeCancelling: boolean;
  transcribePreviewActive: boolean;
  transcribeOverwriteDialogOpen: boolean;
  transcribeOverwriteSegmentCount: number;
  refreshProjects: () => Promise<void>;
  pickAudio: () => Promise<void>;
  clearPickedAudio: () => void;
  createProject: () => Promise<void>;
  createEmptyProject: () => Promise<void>;
  createProjectFromText: () => Promise<void>;
  loadProject: (id: string) => Promise<void>;
  openFile: (fileId: string) => Promise<void>;
  closeFile: () => void;
  closeProject: () => void;
  refreshCurrentProject: () => Promise<void>;
  runTranscribe: () => Promise<void>;
  cancelTranscribe: () => Promise<void>;
  confirmTranscribeOverwrite: () => void;
  cancelTranscribeOverwrite: () => void;
  saveSegments: () => Promise<boolean>;
  deleteProject: (id: string, options?: { skipBrowserConfirm?: boolean }) => Promise<void>;
  exportTxt: () => Promise<void>;
  exportSrt: () => Promise<void>;
  exportDocx: (mode: DocxExportMode) => Promise<void>;
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
  updateSegmentBounds: (idx: number, startSec: number, endSec: number, phase?: "live" | "commit") => void;
  splitAtSelection: () => void;
  splitAtPlayhead: (timeSec: number) => void;
  mergeWithNext: () => void;
  mergeWithPrev: () => void;
  mergeWithNextAt: (idx: number) => void;
  mergeWithPrevAt: (idx: number) => void;
  deleteSegmentAt: (idx: number) => void;
  insertSegmentAfter: (idx: number, mediaDurationSec?: number) => void;
  insertSegmentFromTimeRange: (
    startSec: number,
    endSec: number,
    mediaDurationSec?: number,
    policy?: SegmentOverlapPolicy,
  ) => void;
  flushSegmentTextDrafts: () => void;
  canAutoPunctuate: boolean;
  autoPunctuateBlockReason: string | null;
  autoPunctuateDialog: AutoPunctuateDialogState;
  requestAutoPunctuate: () => void;
  confirmAutoPunctuateConsent: () => void;
  confirmAutoPunctuateWriteback: () => void;
  cancelAutoPunctuate: () => void;
  canRefineSegments: boolean;
  segmentRefineBlockReason: string | null;
  segmentRefineDialog: SegmentRefineDialogState;
  requestSegmentRefine: () => void;
  confirmSegmentRefineConsent: () => void;
  confirmSegmentRefineWriteback: () => void;
  cancelSegmentRefine: () => void;
  bumpLlmRuntimeChanged: () => void;
  closeGateOpen: boolean;
  closeGateIntent: "app-quit" | "navigate";
  stayAfterCloseAttempt: () => void;
  discardUnsavedAndClose: () => void;
  saveAndClose: () => void;
}
