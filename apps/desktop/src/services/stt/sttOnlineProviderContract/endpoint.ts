const INVALID_ENDPOINT_MESSAGE =
  "在线 STT 端点须使用 HTTPS；仅 localhost / 127.0.0.1 / ::1 允许 HTTP。";

function parseEndpointUrl(endpoint: string): URL | null {
  try {
    return new URL(endpoint.trim());
  } catch {
    return null;
  }
}

function isLoopbackHostname(hostname: string): boolean {
  const n = hostname.trim().toLowerCase();
  return n === "localhost" || n === "127.0.0.1" || n === "::1" || n === "[::1]";
}

/** 与解语 `isAllowedExternalProviderEndpoint` 同构 */
export function isAllowedSttOnlineEndpoint(endpoint: string): boolean {
  const parsed = parseEndpointUrl(endpoint);
  if (!parsed) return false;
  if (parsed.protocol === "https:") return true;
  if (parsed.protocol !== "http:") return false;
  return isLoopbackHostname(parsed.hostname);
}

export function assertValidEndpoint(endpoint?: string): void {
  const t = endpoint?.trim();
  if (!t) return;
  if (!isAllowedSttOnlineEndpoint(t)) {
    throw new Error(INVALID_ENDPOINT_MESSAGE);
  }
}
