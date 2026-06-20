/** Sidecar prepare error codes that can resume from partial ModelScope cache. */
export const PREPARE_MODEL_RESUMABLE_ERROR_CODES = new Set([
  "model_prepare_network_error",
  "model_prepare_failed",
  "fetch_failed",
]);

const STABLE_PREPARE_ERROR_CODES = new Set([
  "client_timeout",
  "model_prepare_disk_full",
  "model_prepare_incomplete",
  "vad_prepare_incomplete",
  "model_manifest_path_missing",
  "funasr_not_installed",
  "modelscope_not_installed",
  "unknown",
]);

/** Map raw sidecar exception strings to stable prepare error codes for UI + resume. */
export function normalizePrepareModelErrorCode(code: string): string {
  const c = code.trim();
  if (!c) return "unknown";
  if (STABLE_PREPARE_ERROR_CODES.has(c)) return c;
  if (PREPARE_MODEL_RESUMABLE_ERROR_CODES.has(c)) return c;
  const lower = c.toLowerCase();
  if (
    lower.includes("httpsconnectionpool") ||
    lower.includes("max retries exceeded") ||
    lower.includes("connection refused") ||
    lower.includes("connection reset") ||
    lower.includes("connection aborted") ||
    lower.includes("timed out") ||
    lower.includes("timeout") ||
    lower.includes("network") ||
    lower.includes("temporary failure") ||
    lower.includes("name or service not known")
  ) {
    return "model_prepare_network_error";
  }
  if (
    lower.includes("no space left") ||
    lower.includes("disk full") ||
    lower.includes("errno 28") ||
    lower.includes("not enough space")
  ) {
    return "model_prepare_disk_full";
  }
  return c;
}

export function isPrepareModelResumableError(code: string): boolean {
  const c = normalizePrepareModelErrorCode(code);
  if (PREPARE_MODEL_RESUMABLE_ERROR_CODES.has(c)) return true;
  const lower = c.toLowerCase();
  return lower.includes("timeout") || lower.includes("connection") || lower.includes("network");
}
