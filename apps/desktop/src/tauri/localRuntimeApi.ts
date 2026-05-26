import { invoke } from "@tauri-apps/api/core";
import type {
  LocalRuntimeActionResult,
  LocalRuntimeDiagnose,
  LocalRuntimeDownloadResult,
} from "../services/localRuntime/localRuntimeContract";

export async function localRuntimeDiagnose(): Promise<LocalRuntimeDiagnose> {
  return invoke<LocalRuntimeDiagnose>("local_runtime_diagnose");
}

export async function localRuntimeDownloadSidecar(): Promise<LocalRuntimeDownloadResult> {
  return invoke<LocalRuntimeDownloadResult>("local_runtime_download_sidecar");
}

export async function localRuntimeCancelDownload(): Promise<boolean> {
  return invoke<boolean>("local_runtime_cancel_download");
}

export async function localRuntimeRevalidateInstall(): Promise<LocalRuntimeActionResult> {
  return invoke<LocalRuntimeActionResult>("local_runtime_revalidate_install");
}

export async function localRuntimeClearInstall(): Promise<LocalRuntimeActionResult> {
  return invoke<LocalRuntimeActionResult>("local_runtime_clear_install");
}

export async function localRuntimeRestorePrevious(): Promise<LocalRuntimeActionResult> {
  return invoke<LocalRuntimeActionResult>("local_runtime_restore_previous");
}
