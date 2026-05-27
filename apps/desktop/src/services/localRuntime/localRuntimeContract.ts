export type LocalRuntimeInstalledStatus = "missing" | "installed" | "corrupt";
export type LocalRuntimeManifestStatus =
  | "missing"
  | "ok"
  | "error"
  | "incompatible"
  | "source_rejected"
  | "signature_invalid";

export interface LocalRuntimeInstallProgress {
  phase: string;
  message: string;
  downloadedBytes?: number | null;
  totalBytes?: number | null;
  version?: string | null;
  error?: string | null;
}

export interface LocalRuntimeInstalledInfo {
  status: LocalRuntimeInstalledStatus;
  version?: string | null;
  previousVersion?: string | null;
  executablePath?: string | null;
  rootDir: string;
  detail?: string | null;
  lastVerifyError?: string | null;
  lastInstallPhase?: string | null;
}

export interface LocalRuntimeDiagnose {
  manifestConfigured: boolean;
  manifestSource?: string | null;
  manifestStatus: string;
  manifestIssue?: string | null;
  manifestSignatureKeyId?: string | null;
  availableVersion?: string | null;
  availableSizeBytes?: number | null;
  requiredDiskBytes?: number | null;
  freeDiskBytes?: number | null;
  install: LocalRuntimeInstallProgress;
  installed: LocalRuntimeInstalledInfo;
  blockingIssue?: string | null;
}

export interface LocalRuntimeDownloadResult {
  started: boolean;
  reason?: string | null;
}

export interface LocalRuntimeActionResult {
  ok: boolean;
  reason?: string | null;
}

export function isLocalRuntimeUsable(diag: LocalRuntimeDiagnose | null): boolean {
  return diag?.installed.status === "installed";
}

export function isLocalRuntimeInstallRunning(
  phase: LocalRuntimeInstallProgress["phase"] | null | undefined,
): boolean {
  return phase === "downloading" || phase === "installing" || phase === "verifying";
}

export function isLocalRuntimeManifestInstallBlocked(
  diag: Pick<LocalRuntimeDiagnose, "manifestConfigured" | "manifestStatus"> | null | undefined,
): boolean {
  if (!diag?.manifestConfigured) return true;
  return (
    diag.manifestStatus === "error" ||
    diag.manifestStatus === "incompatible" ||
    diag.manifestStatus === "source_rejected" ||
    diag.manifestStatus === "signature_invalid"
  );
}
