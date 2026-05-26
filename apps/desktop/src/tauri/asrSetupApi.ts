import { invoke } from "@tauri-apps/api/core";
import type { AsrSetupReport } from "../services/asr/asrSetupContract";

export async function asrSetupDiagnose(): Promise<AsrSetupReport> {
  return invoke<AsrSetupReport>("asr_setup_diagnose");
}
