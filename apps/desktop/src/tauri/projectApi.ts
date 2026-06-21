export type {
  FileDetail,
  FileSummary,
  ProjectDetail,
  ProjectMetadata,
  ProjectSummary,
  RawProjectDetail,
  SegmentDto,
  SegmentKind,
} from "./projectTypes";

export type { CommandErrorDto } from "./commandError";
export {
  parseTauriCommandError,
  tauriCommandErrorMessage,
  TauriCommandError,
} from "./commandError";

export type {
  EditLogEntryDto,
  ProjectMetadataInput,
} from "./projectCrudApi";
export {
  exportProjectBundle,
  exportTextFile,
  fileRestoreSegmentsFromEditLog,
  importProjectBundle,
  pickAudioPath,
  projectCreate,
  projectDelete,
  projectList,
  projectListEditLog,
  projectLoad,
  projectRecordEditLog,
  renameProject,
  updateProjectMetadata,
} from "./projectCrudApi";

export type { RunTranscribeOutcome } from "./projectTranscribeApi";
export {
  getLastTranscribeTimeline,
  projectCancelTranscribe,
  projectRunTranscribe,
  projectTranscribeAsyncFinalize,
  projectTranscribeAsyncStart,
  recordTranscribeTimelinePollFailure,
  recordTranscribeTimelinePollProgress,
} from "./projectTranscribeApi";

export type {
  AsrHealthCapabilities,
  AsrModelCacheInfo,
  AsrRuntimePaths,
  BundledAsrLaunchReport,
  ClearOrphanWaveformPeaksResult,
  BundledAsrModelsSeedResult,
  WaveformPeaksCacheInfo,
} from "./projectAsrMaintenanceApi";
export {
  asrAppManagesBundledSidecar,
  asrModelCacheInfo,
  bundledAsrLaunchReport,
  clearAsrModelCache,
  clearOrphanWaveformPeaksCache,
  getAsrRuntimePaths,
  getLocalAsrHubModelPref,
  getLocalAsrRecognitionLanguagePref,
  installFunasrDepsInteractive,
  killLoopbackAsrListeners,
  openAppDataFolder,
  retryBundledAsrSidecar,
  seedBundledAsrModelsIfNeeded,
  setLocalAsrHubModelPref,
  setLocalAsrRecognitionLanguagePref,
  waveformPeaksCacheInfo,
} from "./projectAsrMaintenanceApi";
