import { invoke } from "@tauri-apps/api/core";
import type { OnlineTranscribeBridgePayload } from "../services/stt/sttOnlineProviderContract";
import type { TranscribeTimelineSnapshot } from "../services/transcribeDiag";
import type { FileDetail, ProjectDetail, ProjectSummary, SegmentDto } from "./projectTypes";

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

/** `project_run_transcribe` 返回值（`detail` 为转写后的文件详情） */
export interface RunTranscribeOutcome {
  detail: FileDetail;
  engine: string;
  warnings: string[];
  transcribeTimeline?: TranscribeTimelineSnapshot | null;
}

export interface EditLogEntryDto {
  id: number;
  project_id: string;
  at_ms: number;
  kind: string;
  detail: string;
  has_snapshot: boolean;
}

/** `GET /health` 扩展字段（rushi-asr ≥ 当前仓）；用于桌面自动检测 FunASR。 */
export interface AsrHealthCapabilities {
  ffmpeg_ok: boolean;
  funasr_import_ok: boolean;
  funasr_model_configured: boolean;
  /** 是否显式设置了 RUSHI_FUNASR_MODEL（否则为内置默认模型 id）。 */
  funasr_model_explicit_from_env?: boolean;
  /** 运行时依赖是否就绪（不代表模型一定完整缓存）。 */
  funasr_ready: boolean;
  /** 默认主模型是否已完整缓存。 */
  funasr_default_model_cached?: boolean;
  /** 当前激活主模型是否已完整缓存。 */
  funasr_active_model_cached?: boolean;
  /** 默认辅助 VAD 模型是否已完整缓存。 */
  funasr_vad_model_cached?: boolean;
  /** ct-punc 标点模型是否已完整缓存（Paraformer 多语段所需）。 */
  funasr_punc_model_cached?: boolean;
  /** 当前默认 ASR 所需模型集合是否都已完整缓存。 */
  funasr_required_models_cached?: boolean;
  /** 仅当 runtime + 必需模型都就绪时才应视为真正可转写。 */
  ready_for_transcribe?: boolean;
  transcription_mode: "funasr" | "stub";
  funasr_model_id?: string | null;
  /** Hub id resident in sidecar memory (null when unloaded). */
  funasr_loaded_model_id?: string | null;
  /** Sidecar `RUSHI_FUNASR_LANGUAGE` (R3g-C C4). */
  funasr_language?: string | null;
  funasr_punc_model_id?: string | null;
  /** 侧车 / 壳传入的模型缓存根目录（若有）。 */
  rushi_models_root?: string | null;
}

/** Tauri：安装包内推理侧车最近一次启动结果（供 P1 在 ASR 不可达时提示）。 */
export interface BundledAsrLaunchReport {
  attempted: boolean;
  success: boolean;
  detail?: string | null;
}

export interface AsrModelCacheInfo {
  models_root: string;
  modelscope_cache: string;
  huggingface_cache: string;
  exists: boolean;
  total_bytes: number;
  manifest_path?: string | null;
  manifest_exists: boolean;
}

export interface WaveformPeaksCacheInfo {
  projects_root: string;
  total_bytes: number;
  orphan_bytes: number;
  orphan_file_sets: number;
  orphan_project_dirs: number;
}

export interface ClearOrphanWaveformPeaksResult {
  cache: WaveformPeaksCacheInfo;
  gc: {
    removed_file_sets: number;
    removed_project_dirs: number;
    freed_bytes: number;
  };
}

export async function pickAudioPath(): Promise<string | null> {
  return invoke<string | null>("pick_audio_path");
}

export async function projectCreate(name: string, srcPath: string): Promise<ProjectDetail> {
  // Tauri 2：invoke 顶层参数名使用 camelCase，与 Rust 形参 snake_case 对应。
  return invoke<ProjectDetail>("project_create_from_audio", { name, srcPath });
}

export async function projectList(): Promise<ProjectSummary[]> {
  return invoke<ProjectSummary[]>("project_list");
}

export async function projectLoad(projectId: string): Promise<ProjectDetail> {
  return invoke<ProjectDetail>("project_load", { projectId });
}

export async function projectListEditLog(projectId: string, limit = 40): Promise<EditLogEntryDto[]> {
  return invoke<EditLogEntryDto[]>("project_list_edit_log", { projectId, limit });
}

export async function projectRecordEditLog(
  projectId: string,
  kind: string,
  detail: string,
): Promise<void> {
  return invoke<void>("project_record_edit_log", { projectId, kind, detail });
}

export async function fileRestoreSegmentsFromEditLog(
  fileId: string,
  editLogId: number,
): Promise<void> {
  return invoke<void>("file_restore_segments_from_edit_log", { fileId, editLogId });
}

export async function projectRunTranscribe(
  fileId: string,
  asrBaseUrl?: string | null,
  online?: OnlineTranscribeBridgePayload | null,
): Promise<RunTranscribeOutcome> {
  return invoke<RunTranscribeOutcome>("project_run_transcribe", {
    fileId,
    asrBaseUrl: asrBaseUrl ?? null,
    online: online ?? null,
  });
}

export async function projectTranscribeAsyncStart(
  fileId: string,
  asrBaseUrl?: string | null,
): Promise<{ jobId: string }> {
  const out = await invoke<{ jobId: string }>("project_transcribe_async_start", {
    fileId,
    asrBaseUrl: asrBaseUrl ?? null,
  });
  return out;
}

export async function projectTranscribeAsyncFinalize(
  fileId: string,
  jobId: string,
  asrBaseUrl?: string | null,
): Promise<RunTranscribeOutcome> {
  return invoke<RunTranscribeOutcome>("project_transcribe_async_finalize", {
    fileId,
    jobId,
    asrBaseUrl: asrBaseUrl ?? null,
  });
}

export async function getLastTranscribeTimeline(): Promise<TranscribeTimelineSnapshot | null> {
  return invoke<TranscribeTimelineSnapshot | null>("get_last_transcribe_timeline");
}

export async function recordTranscribeTimelinePollProgress(
  jobId: string,
  windowIndex: number,
  windowCount: number,
): Promise<void> {
  return invoke<void>("record_transcribe_timeline_poll_progress", {
    jobId,
    windowIndex,
    windowCount,
  });
}

export async function recordTranscribeTimelinePollFailure(
  jobId: string,
  errorMessage: string,
): Promise<void> {
  return invoke<void>("record_transcribe_timeline_poll_failure", {
    jobId,
    errorMessage,
  });
}

export async function projectDelete(projectId: string): Promise<void> {
  return invoke<void>("project_delete", { projectId });
}

export async function renameProject(projectId: string, name: string): Promise<ProjectDetail> {
  return invoke<ProjectDetail>("rename_project", { projectId, name });
}

export type ProjectMetadataInput = {
  narrator?: string | null;
  recorded_at?: string | null;
  location?: string | null;
  subject?: string | null;
  transcriber?: string | null;
};

export async function updateProjectMetadata(
  projectId: string,
  metadata: ProjectMetadataInput,
): Promise<ProjectDetail> {
  return invoke<ProjectDetail>("update_project_metadata", {
    projectId,
    narrator: metadata.narrator ?? null,
    recordedAt: metadata.recorded_at ?? null,
    location: metadata.location ?? null,
    subject: metadata.subject ?? null,
    transcriber: metadata.transcriber ?? null,
  });
}

export async function exportProjectBundle(
  projectId: string,
  fileId: string,
  defaultFilename: string,
  segments: SegmentDto[],
): Promise<string | null> {
  return invoke<string | null>("export_project_bundle", {
    projectId,
    fileId,
    defaultFilename,
    segments,
  });
}

export async function importProjectBundle(): Promise<ProjectDetail | null> {
  return invoke<ProjectDetail | null>("import_project_bundle");
}

/** 系统另存为；用户取消时返回 `null`。 */
export async function exportTextFile(defaultFilename: string, content: string): Promise<string | null> {
  return invoke<string | null>("export_text_file", { defaultFilename, content });
}

/** macOS/Linux：弹出文件夹选择器后在所选 Rushi 仓库内执行 FunASR 依赖安装脚本；取消返回 `null`。 */
export async function installFunasrDepsInteractive(): Promise<string | null> {
  return invoke<string | null>("install_funasr_deps_interactive");
}

/** 桌面壳专用：读取 bundled 侧车启动诊断（非 Tauri 环境调用会失败，调用方应 catch）。 */
export async function bundledAsrLaunchReport(): Promise<BundledAsrLaunchReport> {
  return invoke<BundledAsrLaunchReport>("bundled_asr_launch_report");
}

export async function retryBundledAsrSidecar(): Promise<void> {
  return invoke<void>("retry_bundled_asr_sidecar");
}

/** False when `RUSHI_SKIP_BUNDLED_ASR=1` (e.g. `npm run desktop:dev`); shell will not restart 8741. */
export async function asrAppManagesBundledSidecar(): Promise<boolean> {
  return invoke<boolean>("asr_app_manages_bundled_sidecar");
}

/** Stop any process on loopback :8741 (dev model apply / stale listener). */
export async function killLoopbackAsrListeners(): Promise<void> {
  return invoke<void>("kill_loopback_asr_listeners_cmd");
}

export async function openAppDataFolder(): Promise<void> {
  return invoke<void>("open_app_data_folder");
}

/** Canonical desktop models directory (matches bundled sidecar `RUSHI_MODELS_ROOT`). */
export type AsrRuntimePaths = {
  appDataRoot: string;
  modelsRoot: string;
  modelscopeCache: string;
  huggingfaceCache: string;
};

export async function getAsrRuntimePaths(): Promise<AsrRuntimePaths> {
  return invoke<AsrRuntimePaths>("get_asr_runtime_paths");
}

export async function asrModelCacheInfo(): Promise<AsrModelCacheInfo> {
  return invoke<AsrModelCacheInfo>("asr_model_cache_info");
}

export async function clearAsrModelCache(): Promise<AsrModelCacheInfo> {
  return invoke<AsrModelCacheInfo>("clear_asr_model_cache");
}

export async function waveformPeaksCacheInfo(): Promise<WaveformPeaksCacheInfo> {
  return invoke<WaveformPeaksCacheInfo>("waveform_peaks_cache_info");
}

export async function clearOrphanWaveformPeaksCache(): Promise<ClearOrphanWaveformPeaksResult> {
  return invoke<ClearOrphanWaveformPeaksResult>("clear_orphan_waveform_peaks_cache");
}

export async function getLocalAsrHubModelPref(): Promise<string | null> {
  return invoke<string | null>("get_local_asr_hub_model_pref");
}

export async function setLocalAsrHubModelPref(
  hubModelId: string,
  options?: { restartSidecar?: boolean },
): Promise<void> {
  return invoke<void>("set_local_asr_hub_model_pref", {
    hubModelId,
    restartSidecar: options?.restartSidecar ?? false,
  });
}

export async function getLocalAsrRecognitionLanguagePref(): Promise<string> {
  return invoke<string>("get_local_asr_recognition_language_pref");
}

export async function setLocalAsrRecognitionLanguagePref(
  language: string,
  options?: { restartSidecar?: boolean },
): Promise<void> {
  return invoke<void>("set_local_asr_recognition_language_pref", {
    language,
    restartSidecar: options?.restartSidecar ?? false,
  });
}
