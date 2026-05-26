import { invoke } from "@tauri-apps/api/core";
import type {
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
