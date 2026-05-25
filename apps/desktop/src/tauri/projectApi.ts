import { invoke } from "@tauri-apps/api/core";
import type { OnlineTranscribeBridgePayload } from "../services/stt/sttOnlineProviderContract";
import type { FileDetail } from "./fileApi";

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
  /** File container schema: list of files in the project */
  files: { id: string; name: string; file_type: string; updated_at_ms: number }[];
}

/** `project_run_transcribe` 返回值（`detail` 为转写后的文件详情） */
export interface RunTranscribeOutcome {
  detail: FileDetail;
  engine: string;
  warnings: string[];
}

export interface EditLogEntryDto {
  id: number;
  project_id: string;
  at_ms: number;
  kind: string;
  detail: string;
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

export async function projectDelete(projectId: string): Promise<void> {
  return invoke<void>("project_delete", { projectId });
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

export async function openAppDataFolder(): Promise<void> {
  return invoke<void>("open_app_data_folder");
}
