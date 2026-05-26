export type LocalRuntimeInstalledStatus = "missing" | "installed" | "corrupt";

export interface LocalRuntimeInstallProgress {
  phase: "idle" | "downloading" | "installing" | "installed" | "error" | "cancelled" | string;
  message: string;
  downloadedBytes?: number | null;
  totalBytes?: number | null;
  version?: string | null;
  error?: string | null;
}

export interface LocalRuntimeInstalledInfo {
  status: LocalRuntimeInstalledStatus;
  version?: string | null;
  executablePath?: string | null;
  rootDir: string;
  detail?: string | null;
}

export interface LocalRuntimeDiagnose {
  manifestConfigured: boolean;
  manifestSource?: string | null;
  manifestStatus: "missing" | "ok" | "error" | string;
  availableVersion?: string | null;
  install: LocalRuntimeInstallProgress;
  installed: LocalRuntimeInstalledInfo;
  blockingIssue?: string | null;
}

export interface LocalRuntimeDownloadResult {
  started: boolean;
  reason?: string | null;
}

export function isLocalRuntimeUsable(diag: LocalRuntimeDiagnose | null): boolean {
  return diag?.installed.status === "installed";
}
