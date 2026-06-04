import { invoke } from "@tauri-apps/api/core";
import type { ExternalSttOnlineHealthCheckResult } from "../services/stt/sttOnlineProviderContract/types";

export type SttOnlineProbeRequest = {
  url: string;
  headers: Record<string, string>;
  timeoutMs: number;
};

export async function sttProbeOnlineHealth(
  req: SttOnlineProbeRequest,
): Promise<ExternalSttOnlineHealthCheckResult> {
  return await invoke<ExternalSttOnlineHealthCheckResult>("stt_probe_online_health", { req });
}
