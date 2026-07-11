import { invoke } from "@tauri-apps/api/core";
import type {
  AsrSetupReport,
  AsrSupervisorSnapshot,
} from "../services/asr/asrSetupContract";

export async function asrSetupDiagnose(): Promise<AsrSetupReport> {
  return invoke<AsrSetupReport>("asr_setup_diagnose");
}

/** Lightweight read of supervisor FSM (env page / health poll). */
export async function asrSupervisorSnapshot(): Promise<AsrSupervisorSnapshot> {
  return invoke<AsrSupervisorSnapshot>("asr_supervisor_snapshot");
}
