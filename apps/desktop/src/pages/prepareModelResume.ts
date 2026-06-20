/** Sidecar prepare error codes that can resume from partial ModelScope cache. */
export const PREPARE_MODEL_RESUMABLE_ERROR_CODES = new Set([
  "model_prepare_network_error",
  "model_prepare_failed",
  "fetch_failed",
]);

export function isPrepareModelResumableError(code: string): boolean {
  const c = code.trim();
  if (PREPARE_MODEL_RESUMABLE_ERROR_CODES.has(c)) return true;
  const lower = c.toLowerCase();
  return lower.includes("timeout") || lower.includes("connection") || lower.includes("network");
}
