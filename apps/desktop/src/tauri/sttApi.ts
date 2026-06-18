import { invoke } from "@tauri-apps/api/core";
import type { ExternalSttOnlineHealthCheckResult } from "../services/stt/sttOnlineProviderContract/types";

export type SttOnlineProbeRequest = {
  url: string;
  headers: Record<string, string>;
  timeoutMs: number;
};

export type SttApiKeyRequest = {
  apiKeyId?: string;
  apiKey?: string;
};

export async function sttProbeOnlineHealth(
  req: SttOnlineProbeRequest,
): Promise<ExternalSttOnlineHealthCheckResult> {
  return await invoke<ExternalSttOnlineHealthCheckResult>("stt_probe_online_health", { req });
}

export type SttXunfeiCredentialProbeRequest = {
  appId: string;
  apiKey: string;
  apiSecret: string;
  timeoutMs: number;
};

export async function sttProbeXunfeiCredentials(
  req: SttXunfeiCredentialProbeRequest,
): Promise<ExternalSttOnlineHealthCheckResult> {
  return await invoke<ExternalSttOnlineHealthCheckResult>("stt_probe_xunfei_credentials", { req });
}

export async function sttSaveApiKey(req: { apiKeyId?: string; apiKey: string }): Promise<string> {
  return await invoke<string>("stt_save_api_key", { req });
}

export async function sttDeleteApiKey(req: { apiKeyId?: string }): Promise<void> {
  await invoke("stt_delete_api_key", { req });
}

export async function sttHasStoredApiKey(req: { apiKeyId?: string }): Promise<boolean> {
  return await invoke<boolean>("stt_has_stored_api_key", { req });
}

export async function sttReadApiKey(req: { apiKeyId?: string }): Promise<string | null> {
  return await invoke<string | null>("stt_read_api_key", { req });
}
