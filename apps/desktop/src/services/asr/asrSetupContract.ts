import type { BundledAsrLaunchReport } from "../../tauri/projectApi";

export type AsrSetupPortStatus = "free" | "rushi_asr" | "foreign";

export interface AsrSetupHealthSnapshot {
  healthReachable: boolean;
  ffmpegOk: boolean;
  funasrImportOk: boolean;
  funasrReady: boolean;
  funasrDefaultModelCached: boolean;
  funasrVadModelCached: boolean;
  funasrRequiredModelsCached: boolean;
  readyForTranscribe: boolean;
  transcriptionMode: string;
}

export type AsrSetupSidecarIntegrity = "ok" | "corrupt" | "unknown" | "not_installed";

export interface AsrSetupReport {
  portStatus: AsrSetupPortStatus;
  portDetail?: string | null;
  bundledAvailable: boolean;
  sidecarIntegrity: AsrSetupSidecarIntegrity;
  bundledLaunch: BundledAsrLaunchReport;
  health: AsrSetupHealthSnapshot;
  modelsRoot: string;
  diskFreeBytes?: number | null;
  diskLow: boolean;
  readyForTranscribe: boolean;
  summaryLines: string[];
  blockingIssue?: string | null;
}

export type AsrSetupStepStatus = "pending" | "running" | "ok" | "error" | "skipped";
export type AsrSetupOutcome = "idle" | "running" | "blocked" | "ready" | "error";

export type AsrSetupStepId = "diagnose" | "sidecar" | "health" | "model" | "done";

export interface AsrSetupStep {
  id: AsrSetupStepId;
  label: string;
  status: AsrSetupStepStatus;
  detail?: string;
}

export const ASR_SETUP_INITIAL_STEPS: AsrSetupStep[] = [
  { id: "diagnose", label: "环境诊断", status: "pending" },
  { id: "sidecar", label: "启动内置侧车", status: "pending" },
  { id: "health", label: "检测 ASR 能力", status: "pending" },
  { id: "model", label: "准备当前所选模型", status: "pending" },
  { id: "done", label: "完成", status: "pending" },
];

export function formatDiskFree(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes)) return "未知";
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(0)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}
