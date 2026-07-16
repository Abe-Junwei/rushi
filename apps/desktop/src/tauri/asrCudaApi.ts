import { invoke } from "@tauri-apps/api/core";

export type AsrCudaInstallProgress = {
  phase: string;
  message: string;
  downloadedBytes?: number | null;
  totalBytes?: number | null;
  version?: string | null;
  error?: string | null;
};

export type AsrCudaSidecarStatus = {
  platformSupported: boolean;
  nvidiaDetected: boolean;
  cudaInstalled: boolean;
  manifestConfigured: boolean;
  recommendDownload: boolean;
  manifestIssue?: string | null;
  installedVersion?: string | null;
  install: AsrCudaInstallProgress;
};

export type AsrCudaDownloadResult = {
  started: boolean;
  reason?: string | null;
};

export async function asrCudaSidecarStatus(): Promise<AsrCudaSidecarStatus> {
  return invoke<AsrCudaSidecarStatus>("asr_cuda_sidecar_status");
}

export async function asrDownloadCudaSidecar(): Promise<AsrCudaDownloadResult> {
  return invoke<AsrCudaDownloadResult>("asr_download_cuda_sidecar");
}

export async function asrCancelCudaSidecarDownload(): Promise<boolean> {
  return invoke<boolean>("asr_cancel_cuda_sidecar_download");
}

export function isAsrCudaInstallRunning(phase: string | null | undefined): boolean {
  return phase === "downloading" || phase === "installing" || phase === "verifying";
}
