import { invoke } from "@tauri-apps/api/core";

/** 另存为诊断 zip；用户取消返回 `null`。 */
export async function p4ExportDiagnosticBundle(): Promise<string | null> {
  return invoke<string | null>("p4_export_diagnostic_bundle");
}
