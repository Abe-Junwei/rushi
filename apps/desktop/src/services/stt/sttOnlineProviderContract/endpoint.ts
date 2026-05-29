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

function isBlockedPrivateOrMetadataHost(hostname: string): boolean {
  const n = hostname.trim().toLowerCase();
  if (isLoopbackHostname(n)) return false;
  if (n === "169.254.169.254" || n === "metadata.google.internal") return true;
  if (n === "0.0.0.0") return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(n)) return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(n)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(n)) return true;
  return false;
}

/** 与解语 `isAllowedExternalProviderEndpoint` 同构 */
export function isAllowedSttOnlineEndpoint(endpoint: string): boolean {
  const parsed = parseEndpointUrl(endpoint);
  if (!parsed) return false;
  if (isBlockedPrivateOrMetadataHost(parsed.hostname)) return false;
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
