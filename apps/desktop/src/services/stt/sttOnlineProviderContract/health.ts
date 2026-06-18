import { isTauriRuntime } from "../../../config/env";
import { sttProbeOnlineHealth, sttProbeXunfeiCredentials } from "../../../tauri/sttApi";
import {
  STT_ONLINE_ASSEMBLYAI_DEFAULT_PROBE_URL,
  STT_ONLINE_DASHSCOPE_DEFAULT_PROBE_URL,
  STT_ONLINE_DEEPGRAM_DEFAULT_PROBE_URL,
  STT_ONLINE_OPENAI_DEFAULT_PROBE_URL,
  capSttOnlineProbeTimeoutMs,
} from "./constants";
import { getSttOnlineProviderDefinition } from "./definitions";
import { isAllowedSttOnlineEndpoint } from "./endpoint";
import { getSttOnlineApiKeyFromMemory, getSttOnlineApiSecretFromMemory } from "./memorySecrets";
import { ensureSttOnlineApiKeyForSession } from "./apiKeyStorage";
import { ensureSttOnlineApiSecretForSession } from "./apiSecretStorage";
import {
  normalizeExternalSttOnlineRuntimeConfig,
  resolveExternalSttOnlineRuntimeConfig,
} from "./runtimeConfig";
import {
  resolveSttOnlinePresetTranscribeUrl,
  sttOnlineProviderEndpointUserConfigurable,
  sttOnlineProviderUsesCredentialsOnlyProbe,
} from "./presetEndpoints";
import type {
  ExternalSttOnlineHealthCheckOptions,
  ExternalSttOnlineHealthCheckResult,
  ExternalSttOnlineRuntimeConfig,
} from "./types";
import {
  authHeaderForProbe,
  probeExternalSttOnlineHealthViaFetch,
} from "./healthProbeFetch";

/**
 * 健康探测实际请求的 URL（显式 endpoint 优先；OpenAI / AssemblyAI 无 endpoint 时用默认探测点）。
 */
export function resolveSttOnlineProbeUrl(runtime: ExternalSttOnlineRuntimeConfig): string | null {
  if (sttOnlineProviderUsesCredentialsOnlyProbe(runtime.selectedProviderId)) {
    return null;
  }
  if (sttOnlineProviderEndpointUserConfigurable(runtime.selectedProviderId)) {
    const explicit = runtime.endpoint?.trim();
    if (explicit) {
      if (!isAllowedSttOnlineEndpoint(explicit)) return null;
      return explicit;
    }
    return null;
  }
  const explicit = runtime.endpoint?.trim();
  if (explicit) {
    if (!isAllowedSttOnlineEndpoint(explicit)) return null;
    return explicit;
  }
  if (runtime.selectedProviderId === "openai") return STT_ONLINE_OPENAI_DEFAULT_PROBE_URL;
  if (runtime.selectedProviderId === "assemblyai") return STT_ONLINE_ASSEMBLYAI_DEFAULT_PROBE_URL;
  if (runtime.selectedProviderId === "dashscope-asr") return STT_ONLINE_DASHSCOPE_DEFAULT_PROBE_URL;
  if (runtime.selectedProviderId === "deepgram") return STT_ONLINE_DEEPGRAM_DEFAULT_PROBE_URL;
  return null;
}

/**
 * 对配置的 `endpoint` 发 GET（与解语 `probeExternalAcousticProviderHealth` 同构）。
 * 桌面端 HTTP 经 Tauri/Rust reqwest；`fetchImpl` 仅用于单元测试注入。
 */
export async function probeExternalSttOnlineHealth(
  options: ExternalSttOnlineHealthCheckOptions = {},
): Promise<ExternalSttOnlineHealthCheckResult> {
  const runtime = normalizeExternalSttOnlineRuntimeConfig(options.runtimeConfig ?? resolveExternalSttOnlineRuntimeConfig());
  if (!runtime.enabled) {
    return { state: "disabled", available: false, message: "在线 STT 未启用。" };
  }
  const explicit = runtime.endpoint?.trim();
  if (explicit && !isAllowedSttOnlineEndpoint(explicit)) {
    return {
      state: "unconfigured",
      available: false,
      endpoint: explicit,
      message: "在线 STT 端点须使用 HTTPS；仅 localhost / 127.0.0.1 / ::1 允许 HTTP。",
    };
  }
  const def = getSttOnlineProviderDefinition(runtime.selectedProviderId);
  await ensureSttOnlineApiKeyForSession();
  await ensureSttOnlineApiSecretForSession();
  const apiKey = getSttOnlineApiKeyFromMemory()?.trim();
  if (!apiKey) {
    return {
      state: "unconfigured",
      available: false,
      endpoint: resolveSttOnlinePresetTranscribeUrl(runtime.selectedProviderId) ?? undefined,
      message: "请填写并保存 API Key。",
    };
  }

  if (sttOnlineProviderUsesCredentialsOnlyProbe(runtime.selectedProviderId)) {
    if (def?.requiresPersistedAppKey && !runtime.appKey?.trim()) {
      return {
        state: "unconfigured",
        available: false,
        message: `请填写${def.persistedAppKeyFieldLabel ?? "应用标识"}。`,
      };
    }
    if (def?.requiresApiSecret && !getSttOnlineApiSecretFromMemory()?.trim()) {
      return {
        state: "unconfigured",
        available: false,
        message: "请填写 APISecret。",
      };
    }
    const preset = resolveSttOnlinePresetTranscribeUrl(runtime.selectedProviderId);
    if (runtime.selectedProviderId === "iflytek-speed-asr") {
      if (!isTauriRuntime()) {
        return {
          state: "unknown-error",
          available: false,
          endpoint: preset ?? undefined,
          message: "讯飞凭证探测须在桌面环境中运行。",
        };
      }
      return sttProbeXunfeiCredentials({
        appId: runtime.appKey?.trim() ?? "",
        apiKey,
        apiSecret: getSttOnlineApiSecretFromMemory()?.trim() ?? "",
        timeoutMs: capSttOnlineProbeTimeoutMs(runtime.timeoutMs),
      });
    }
    return {
      state: "available",
      available: true,
      endpoint: preset ?? undefined,
      message:
        "厂商转写端点已预置；凭证已填写。保存后即可转写，首次使用以实际识别结果为准。",
    };
  }

  const endpoint = resolveSttOnlineProbeUrl(runtime);
  if (!endpoint) {
    return {
      state: "unconfigured",
      available: false,
      message: "未配置在线 STT URL，或所选厂商不支持无 URL 探测。",
    };
  }
  if (!isAllowedSttOnlineEndpoint(endpoint)) {
    return {
      state: "unconfigured",
      available: false,
      endpoint,
      message: "在线 STT 端点须使用 HTTPS；仅 localhost / 127.0.0.1 / ::1 允许 HTTP。",
    };
  }

  if (options.signal?.aborted) {
    return { state: "aborted", available: false, endpoint, message: "探测已取消。" };
  }

  if (options.fetchImpl) {
    return probeExternalSttOnlineHealthViaFetch(options, runtime, endpoint, def, apiKey);
  }

  if (!isTauriRuntime()) {
    return {
      state: "unknown-error",
      available: false,
      endpoint,
      message: "在线 STT 探测须在桌面环境中运行。",
    };
  }

  const headers: Record<string, string> = { accept: "application/json" };
  if (def) Object.assign(headers, authHeaderForProbe(def, apiKey, runtime.selectedProviderId));
  else headers.authorization = `Bearer ${apiKey}`;

  try {
    return await sttProbeOnlineHealth({
      url: endpoint,
      headers,
      timeoutMs: capSttOnlineProbeTimeoutMs(runtime.timeoutMs),
    });
  } catch (e) {
    return {
      state: "unknown-error",
      available: false,
      endpoint,
      message: e instanceof Error ? e.message : String(e),
    };
  }
}
