import { capSttOnlineProbeTimeoutMs } from "./constants";
import type {
  ExternalSttOnlineHealthCheckOptions,
  ExternalSttOnlineHealthCheckResult,
  ExternalSttOnlineRuntimeConfig,
  SttOnlineProviderDefinition,
} from "./types";

export function authHeaderForProbe(
  def: SttOnlineProviderDefinition,
  apiKey: string,
  providerId: string,
): Record<string, string> {
  if (providerId === "deepgram") {
    const token = apiKey.trim().replace(/^Bearer\s+/i, "").replace(/^Token\s+/i, "");
    return { authorization: `Token ${token}` };
  }
  if (def.authStyle === "bearer") {
    return { authorization: `Bearer ${apiKey}` };
  }
  const raw = (def.headerName ?? "Authorization").trim();
  if (raw.toLowerCase() === "authorization") {
    return { authorization: apiKey };
  }
  return { [raw]: apiKey };
}

export async function probeExternalSttOnlineHealthViaFetch(
  options: ExternalSttOnlineHealthCheckOptions,
  runtime: ExternalSttOnlineRuntimeConfig,
  endpoint: string,
  def: SttOnlineProviderDefinition | undefined,
  apiKey: string,
): Promise<ExternalSttOnlineHealthCheckResult> {
  const probeTimeoutMs = capSttOnlineProbeTimeoutMs(runtime.timeoutMs);
  const fetchImpl = options.fetchImpl ?? fetch;
  const ctrl = new AbortController();
  const t = globalThis.setTimeout(() => ctrl.abort(), probeTimeoutMs);
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
    if (def) Object.assign(headers, authHeaderForProbe(def, apiKey, runtime.selectedProviderId));
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
        state: "method-not-allowed",
        available: false,
        endpoint,
        status: res.status,
        latencyMs,
        message: "端点可达但不接受 GET；请确认转写 POST URL 正确，或使用厂商默认探测点。",
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
        message: `探测超时（${probeTimeoutMs}ms）。`,
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
