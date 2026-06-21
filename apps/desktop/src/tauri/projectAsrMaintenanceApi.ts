import { invoke } from "@tauri-apps/api/core";

/** `GET /health` 扩展字段（rushi-asr ≥ 当前仓）；用于桌面自动检测 FunASR。 */
export interface AsrHealthCapabilities {
  ffmpeg_ok: boolean;
  /** 裸 ``ffmpeg`` 是否可由 PATH 解析（FunASR generate 依赖）。 */
  ffmpeg_on_path?: boolean;
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
  /** FunASR 权重是否已加载到侧车进程内存。 */
  model_loaded_in_memory?: boolean;
  /** 内存中 loaded id 是否与配置的 funasr_model_id 一致。 */
  model_memory_matches_config?: boolean;
  /** 侧车 config 模型已加载且磁盘依赖齐备（D1=D2 对齐时的 selected-ready）。 */
  selected_model_ready?: boolean;
  inference_queue_pending?: number;
  inference_queue_running?: number;
  inference_requested_workers?: number;
  inference_max_workers?: number;
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

export interface OfflineAsrModelsPackImportResult {
  imported_bytes: number;
  models_root: string;
  modelscope_cache: string;
  pack_version: number;
  bundle_id: string;
  seeded_at: string;
  skipped_reseed?: boolean;
}

export interface ClearOrphanWaveformPeaksResult {
  cache: WaveformPeaksCacheInfo;
  gc: {
    removed_file_sets: number;
    removed_project_dirs: number;
    freed_bytes: number;
  };
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

export async function pickAndImportOfflineAsrModelsPack(): Promise<OfflineAsrModelsPackImportResult | null> {
  return invoke<OfflineAsrModelsPackImportResult | null>("pick_and_import_offline_asr_models_pack");
}

export async function importOfflineAsrModelsPack(sourcePath: string): Promise<OfflineAsrModelsPackImportResult> {
  return invoke<OfflineAsrModelsPackImportResult>("import_offline_asr_models_pack", { sourcePath });
}

export async function openOfflineAsrModelsPackReleasePage(appVersion: string): Promise<void> {
  return invoke<void>("open_offline_asr_models_pack_release_page", { appVersion });
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
