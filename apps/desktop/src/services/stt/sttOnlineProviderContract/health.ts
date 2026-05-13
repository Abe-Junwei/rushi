import {
  STT_ONLINE_OPENAI_DEFAULT_PROBE_URL,
  STT_ONLINE_ASSEMBLYAI_DEFAULT_PROBE_URL,
} from "./constants";
import { getSttOnlineProviderDefinition } from "./definitions";
import { isAllowedSttOnlineEndpoint } from "./endpoint";
import { getSttOnlineApiKeyFromMemory } from "./memorySecrets";
import {
  normalizeExternalSttOnlineRuntimeConfig,
  resolveExternalSttOnlineRuntimeConfig,
} from "./runtimeConfig";
import type {
  ExternalSttOnlineHealthCheckOptions,
  ExternalSttOnlineHealthCheckResult,
  SttOnlineProviderDefinition,
} from "./types";

function authHeaderForProbe(def: SttOnlineProviderDefinition, apiKey: string): Record<string, string> {
  if (def.authStyle === "bearer") {
    return { authorization: `Bearer ${apiKey}` };
  }
  const raw = (def.headerName ?? "Authorization").trim();
  if (raw.toLowerCase() === "authorization") {
    return { authorization: apiKey };
  }
  return { [raw]: apiKey };
}

/**
 * 健康探测实际请求的 URL（显式 endpoint 优先；OpenAI / AssemblyAI 无 endpoint 时用默认探测点）。
 */
import type { ExternalSttOnlineRuntimeConfig } from "./types";

export function resolveSttOnlineProbeUrl(runtime: ExternalSttOnlineRuntimeConfig): string | null {
  const explicit = runtime.endpoint?.trim();
  if (explicit) {
    if (!isAllowedSttOnlineEndpoint(explicit)) return null;
    return explicit;
  }
  if (runtime.selectedProviderId === "openai") return STT_ONLINE_OPENAI_DEFAULT_PROBE_URL;
  if (runtime.selectedProviderId === "assemblyai") return STT_ONLINE_ASSEMBLYAI_DEFAULT_PROBE_URL;
  return null;
}

/**
 * 对配置的 `endpoint` 发 GET（与解语 `probeExternalAcousticProviderHealth` 同构）。
 * 多数云厂商根 URL 未必支持 GET 200；失败仅表示「未校验通过」，不阻塞后续在 Tauri 内走专用路径。
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

  const def = getSttOnlineProviderDefinition(runtime.selectedProviderId);
  const apiKey = getSttOnlineApiKeyFromMemory()?.trim();
  if (!apiKey) {
    return {
      state: "unconfigured",
      available: false,
      endpoint,
      message: "未在内存中设置 API Key（关闭页面后需重新输入）。",
    };
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const ctrl = new AbortController();
  const t = globalThis.setTimeout(() => ctrl.abort(), runtime.timeoutMs);
  const onAbort = () => ctrl.abort();
  if (options.signal) {
    if (options.signal.aborted) ctrl.abort();
    else options.signal.addEventListener("abort", onAbort, { once: true });
  }

  const cleanup = () => {
    globalThis.clearTimeout(t);
    options.signal?.removeEventListener("abort", onAbort);
  };

  if (options.signal?.aborted) {
    cleanup();
    return { state: "aborted", available: false, endpoint, message: "探测已取消。" };
  }

  const started = Date.now();
  try {
    const headers: Record<string, string> = { accept: "application/json" };
    if (def) Object.assign(headers, authHeaderForProbe(def, apiKey));
    else headers.authorization = `Bearer ${apiKey}`;

    const res = await fetchImpl(endpoint, { method: "GET", headers, signal: ctrl.signal });
    const latencyMs = Math.max(0, Date.now() - started);
    if (res.ok) {
      return { state: "available", available: true, endpoint, status: res.status, latencyMs };
    }
    if (res.status === 401) {
      return {
        state: "unauthorized",
        available: false,
        endpoint,
        status: res.status,
        latencyMs,
        message: "密钥被拒绝 (401)。",
      };
    }
    if (res.status === 403) {
      return {
        state: "forbidden",
        available: false,
        endpoint,
        status: res.status,
        latencyMs,
        message: "访问被拒绝 (403)。",
      };
    }
    if (res.status === 405) {
      return {
        state: "available",
        available: true,
        endpoint,
        status: res.status,
        latencyMs,
        message: "端点可达但可能不接受 GET（可改由 Tauri 专用探测）。",
      };
    }
    return {
      state: "http-error",
      available: false,
      endpoint,
      status: res.status,
      latencyMs,
      message: `HTTP ${res.status}`,
    };
  } catch (e) {
    const timedOut = ctrl.signal.aborted && !options.signal?.aborted;
    const isAbort = e instanceof Error && e.name === "AbortError";
    if (options.signal?.aborted || (isAbort && !timedOut)) {
      return { state: "aborted", available: false, endpoint, message: "探测已取消。" };
    }
    if (timedOut) {
      return {
        state: "timeout",
        available: false,
        endpoint,
        message: `探测超时（${runtime.timeoutMs}ms）。`,
      };
    }
    if (e instanceof TypeError) {
      return {
        state: "network-error",
        available: false,
        endpoint,
        message: e.message || "网络错误。",
      };
    }
    return {
      state: "unknown-error",
      available: false,
      endpoint,
      message: e instanceof Error ? e.message : String(e),
    };
  } finally {
    cleanup();
  }
}
