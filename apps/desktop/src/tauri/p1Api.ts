import { invoke } from "@tauri-apps/api/core";
import type { P1OnlineTranscribeBridgePayload } from "../services/stt/sttOnlineProviderContract";

export interface ProjectSummary {
  id: string;
  name: string;
  updated_at_ms: number;
}

export interface SegmentDto {
  idx: number;
  start_sec: number;
  end_sec: number;
  text: string;
  /** ASR 置信度 [0,1]，stub 等可为 null */
  confidence?: number | null;
  /** 引擎或 stub 标记的低置信 / 占位 */
  low_confidence?: boolean;
  /** 如 stub 说明、引擎附注 */
  detail?: string | null;
}

export interface ProjectDetail {
  id: string;
  name: string;
  audio_storage_path: string;
  created_at_ms: number;
  updated_at_ms: number;
  segments: SegmentDto[];
}

/** `p1_project_run_transcribe` 返回值 */
export interface RunTranscribeOutcome {
  detail: ProjectDetail;
  engine: string;
  warnings: string[];
}

/** `GET /health` 扩展字段（rushi-asr ≥ 当前仓）；用于桌面自动检测 FunASR。 */
export interface AsrHealthCapabilities {
  ffmpeg_ok: boolean;
  funasr_import_ok: boolean;
  funasr_model_configured: boolean;
  /** 是否显式设置了 RUSHI_FUNASR_MODEL（否则为内置默认模型 id）。 */
  funasr_model_explicit_from_env?: boolean;
  funasr_ready: boolean;
  transcription_mode: "funasr" | "stub";
  funasr_model_id?: string | null;
  /** 侧车 / 壳传入的模型缓存根目录（若有）。 */
  rushi_models_root?: string | null;
  /** 启发式：默认模型权重是否已在 MODELSCOPE_CACHE 中探测到。 */
  funasr_default_model_cached?: boolean;
}

/** Tauri：安装包内推理侧车最近一次启动结果（供 P1 在 ASR 不可达时提示）。 */
export interface BundledAsrLaunchReport {
  attempted: boolean;
  success: boolean;
  detail?: string | null;
}

export async function p1PickAudioPath(): Promise<string | null> {
  return invoke<string | null>("p1_pick_audio_path");
}

export async function p1ProjectCreate(name: string, srcPath: string): Promise<ProjectDetail> {
  // Tauri 2：invoke 顶层参数名使用 camelCase，与 Rust 形参 snake_case 对应。
  return invoke<ProjectDetail>("p1_project_create", { name, srcPath });
}

export async function p1ProjectList(): Promise<ProjectSummary[]> {
  return invoke<ProjectSummary[]>("p1_project_list");
}

export async function p1ProjectLoad(projectId: string): Promise<ProjectDetail> {
  return invoke<ProjectDetail>("p1_project_load", { projectId });
}

export async function p1ProjectSaveSegments(projectId: string, segments: SegmentDto[]): Promise<void> {
  return invoke<void>("p1_project_save_segments", { projectId, segments });
}

export async function p1ProjectRunTranscribe(
  projectId: string,
  asrBaseUrl?: string | null,
  online?: P1OnlineTranscribeBridgePayload | null,
): Promise<RunTranscribeOutcome> {
  return invoke<RunTranscribeOutcome>("p1_project_run_transcribe", {
    projectId,
    asrBaseUrl: asrBaseUrl ?? null,
    online: online ?? null,
  });
}

export async function p1ProjectDelete(projectId: string): Promise<void> {
  return invoke<void>("p1_project_delete", { projectId });
}

/** 系统另存为；用户取消时返回 `null`。 */
export async function p1ExportTextFile(defaultFilename: string, content: string): Promise<string | null> {
  return invoke<string | null>("p1_export_text_file", { defaultFilename, content });
}

/** macOS/Linux：弹出文件夹选择器后在所选 Rushi 仓库内执行 FunASR 依赖安装脚本；取消返回 `null`。 */
export async function p1InstallFunasrDepsInteractive(): Promise<string | null> {
  return invoke<string | null>("p1_install_funasr_deps_interactive");
}

/** 桌面壳专用：读取 bundled 侧车启动诊断（非 Tauri 环境调用会失败，调用方应 catch）。 */
export async function bundledAsrLaunchReport(): Promise<BundledAsrLaunchReport> {
  return invoke<BundledAsrLaunchReport>("bundled_asr_launch_report");
}

export async function p1RetryBundledAsrSidecar(): Promise<void> {
  return invoke<void>("p1_retry_bundled_asr_sidecar");
}

export async function p1OpenAppDataFolder(): Promise<void> {
  return invoke<void>("p1_open_app_data_folder");
}
