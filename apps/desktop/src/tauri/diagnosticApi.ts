import { invoke } from "@tauri-apps/api/core";

/** 另存为诊断 zip；用户取消返回 `null`。 */
export async function exportDiagnosticBundle(): Promise<string | null> {
  return invoke<string | null>("export_diagnostic_bundle");
}
